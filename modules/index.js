var request = require('request');
var pump = require('pump');
var thunky = require('thunky');
var JSONStream = require('JSONStream');
var EventEmitter = require('events').EventEmitter;
var stream = require('stream-wrapper');
var thunky = require('thunky');
var LRU = require('lru-cache');
var getJSON = require('../getJSON');
var fetch = require('./fetch');
var level = require('../level');
var union = require('sorted-union-stream');

stream = stream.defaults({objectMode:true});

var noop = function() {};
var modulesAdded = 0;
var cache = new LRU(50000);

var countModules = thunky(function (cb) {
	level.meta.get('count', function (err, cnt) {
		if (cnt) return cb(null, cnt)

		level.modules.createReadStream()
			.on('data', function () {
				modulesAdded++
			})
			.on('error', function (err) {
				cb(err)
			})
			.on('end', function () {
				cb(null)
			})
	})
})

countModules() // trigger this right away to avoid rcs

exports.get = function(name, callback) {
	if (cache.has(name)) return callback(null, cache.get(name));
	level.modules.get(name, function(err, module) {
		if (err) return callback(err);
		cache.set(name, module);
		callback(null, module);
	});
};

var encJSON = function(obj) {
	return encodeURIComponent(JSON.stringify(obj));
};

var once = function(fn) {
	var col = {};

	return function(name, callback) {
		var key = '.'+name;

		if (col[key]) return col[key](callback);

		col[key] = thunky(function(callback) {
			fn(name, callback);
		});

		col[key](callback);
	};
};

var toISOString = function (d) {
  return d.toISOString ? d.toISOString() : d
}

var indexModule = function (mod, old, cb) {
  var batch = []

  if (old && old.github) {
    batch.push({
      type: 'del',
      prefix: level.modules.username,
      key: old.github.username + '~' + toISOString(old.cached) + '~' + old._id
    })
    batch.push({
      type: 'del',
      prefix: level.modules.cached,
      key: toISOString(old.cached) + '~' + old._id
    })

    for (var i = 0; i < old.github.dependents.length; i++) {
      batch.push({
        type: 'del',
        prefix: level.modules.dependents,
        key: old.github.dependents[i] + '~' + toISOString(old.cached) + '~' + old._id,
      })
    }
  }

  if (mod.github) {
    batch.push({
      type: 'put',
      prefix: level.modules.username,
      key: mod.github.username + '~' + toISOString(mod.cached) + '~' + mod._id,
      value: mod._id
    })
    batch.push({
      type: 'put',
      prefix: level.modules.cached,
      key: toISOString(mod.cached) + '~' + mod._id,
      value: mod._id
    })

    for (var i = 0; i < mod.github.dependents.length; i++) {
      batch.push({
        type: 'put',
        prefix: level.modules.dependents,
        key: mod.github.dependents[i] + '~' + toISOString(mod.cached) + '~' + mod._id,
        value: mod._id
      })
    }
  }

  batch.push({
    type: 'put',
    prefix: level.modules,
    key: mod._id,
    value: mod
  })

  if (!old) {
  	modulesAdded++
  	batch.push({
  		type: 'put',
  		prefix: level.meta,
  		key: 'count',
  		value: modulesAdded
  	})
  }

  level.batch(batch, cb)
}

exports.info = function(callback) {
	countModules(function(err, baseCount) {
		if (err) return callback(err);
		level.meta.get('modules', function(err, meta) {
			if (err && !err.notFound) return callback(err);
			callback(null, {
				modules: baseCount + modulesAdded,
				seq: meta && meta.seq || 0
			});
		});
	});
};

var createSearchStream = function (q) {
	if (q.cached) {
		if (q.username) {
			return level.modules.username.createReadStream({
				start: q.username + '~' + toISOString(q.cached) + '~',
				end: q.username + '~~'
			})
		}
		if (q.dependents) {
			return level.modules.dependents.createReadStream({
				start: q.dependents + '~' + toISOString(q.cached) + '~',
				end: q.dependents + '~~'
			})
		}
		return level.modules.cached.createReadStream({
			start: toISOString(q.cached) + '~'
		})
	}
	if (q.username) {
		return level.modules.username.createReadStream({
			start: q.username + '~',
			end: q.username + '~~'
		})
	}
	if (q.dependents) {
		return level.modules.dependents.createReadStream({
			start: q.dependents + '~',
			end: q.dependents + '~~'
		})
	}

	throw new Error('Unknown query')
}

var toArray = function (arr) {
	if (Array.isArray(arr)) return arr
	return [].concat(arr || [])
}

var keyify = function(data) {
	return data.key.slice(data.key.indexOf('~') + 1)
}

exports.createReadStream = function(queries) {
	if (!Array.isArray(queries)) queries = [].concat(queries || [])
	if (!queries.length) return level.modules.createValueStream()

	var normalized = []

	for (var i = 0; i < queries.length; i++) {
		var q = queries[i]
		var deps = toArray(q.dependents)
		var username = toArray(q.username)

		for (var j = 0; j < deps.length; j++) {
			normalized.push({
				cached: q.cached,
				dependents: deps[j]
			})
		}
		for (var j = 0; j < username.length; j++) {
			normalized.push({
				cached: q.cached,
				username: username[j]
			})
		}
		if (!q.dependents && !q.username && q.cached) {
			normalized.push({
				cached: q.cached
			})
		}
	}

	// just return an empty stream
	if (!normalized.length) return level.modules.createValueStream({start: '~'})

	var results = normalized
		.map(createSearchStream)
		.reduce(function (a, b) {
			return union(a, b, keyify)
		})

	var mods = stream.transform(function (data, enc, cb) {
		exports.get(data.value, cb)
	})

	pump(results, mods)
	return mods
};

exports.update = function(opts, callback) {
	if (typeof opts === 'function') return exports.update(null, opts);
	if (!opts) opts = {};
	if (!callback) callback = noop;

	var progress = new EventEmitter();
	var ended = false;

	progress.on('end', callback);

	opts.maxAge = opts.maxAge || 3600 * 1000;

	var fetchOnce = once(function(name, callback) {
		fetch(name, opts, callback);
	});

	var ensureModule = once(function(name, callback) {
		fetchOnce(name, function(err, module) {
			if (err || !module) return callback(err);

			var deps = module.dependents;
			var uniq = {};
			var i = 0;
			var loop = function() {
				if (i === deps.length) {
					module.github = module.github || {};
					module.github.dependents = Object.keys(uniq);
					cache.del(module._id);
					level.modules.get(module._id, function(err, stale) {
						if (err && !err.notFound) return callback(err);
						indexModule(module, stale, function(err) {
							if (err) return callback(err);
							if (!ended) progress.emit('module', module);
							callback(null, module, stale);
						});
					});
					return;
				}

				var name = deps[i++];
				var ondep = function(err, dep) {
					if (err) return callback(err);
					if (!dep || !dep.github || !dep.github.username || !dep.github.maintainer) return loop();
					uniq[dep.github.username] = true;
					loop();
				};

				level.modules.get(name, function(err, dep) {
					if (err && err.notFound) err = null;
					if (err || dep) return ondep(err, dep);
					fetchOnce(name, ondep);
				});
			};

			loop();
		});
	});

	var ensureDependencies = function(fresh, stale, callback) {
		// if deps has changed we need to ensure them as their dependents have changed as well
		var diff = {};

		fresh.dependencies.forEach(function(dep) {
			diff[dep] = 1;
		});
		stale.dependencies.forEach(function(dep) {
			if (diff[dep] === 1) delete diff[dep];
			else diff[dep] = -1;
		});

		diff = Object.keys(diff).map(function(dep) {
			return dep.slice(1);
		});

		var i = 0;
		var loop = function(err) {
			if (err) return callback(err);
			if (i === diff.length) return callback();
			ensureModule(diff[i++], loop);
		};

		loop();
	};

	var onlastupdated = function(seq) {
		pump(
			request('https://skimdb.npmjs.com/registry/_changes?since='+seq),
			JSONStream.parse('results.*'),
			stream.transform(function(row, enc, callback) {
				ensureModule(row.id, function retry (err, fresh, stale) {
					if (err && opts.maxAge) {
						opts.forceRetryError = true;
						return ensureModule(row.id, retry);
					}

					opts.forceRetryError = false;

					if (err) return callback(err);
					if (!stale || !fresh) return callback(null, row);

					ensureDependencies(fresh, stale, function() {
						callback(err, row);
					});
				});
			}),
			stream.writable(function(row, enc, callback) {
				level.meta.put('modules', {seq: row.seq}, callback);
			}),
			function(err) {
				ended = true;
				progress.emit('end', err);
			}
		);
	};

	if (opts.updated) throw new Error('options.updated is no longer supported. fix me.');

	countModules(function () {
		level.meta.get('modules', function(err, doc) {
			if (err && !err.notFound) return progress.emit('error', err);
			onlastupdated(doc ? doc.seq : 0);
		});
	});

	return progress;
};
