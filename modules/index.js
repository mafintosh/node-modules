var request = require('request');
var pump = require('pump');
var thunky = require('thunky');
var JSONStream = require('JSONStream');
var EventEmitter = require('events').EventEmitter;
var stream = require('stream-wrapper');
var LRU = require('lru-cache');
var getJSON = require('../getJSON');
var fetch = require('./fetch');
var mongo = require('../mongo');

stream = stream.defaults({objectMode:true});

var noop = function() {};
var cache = new LRU(50000);

exports.get = function(name, callback) {
	if (cache.has(name)) return callback(null, cache.get(name));
	mongo.modules.findOne({_id:name}, function(err, module) {
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

exports.info = function(callback) {
	mongo.modules.count(function(err, count) {
		if (err) return callback(err);
		mongo.meta.findOne({_id:'modules'}, function(err, meta) {
			if (err) return callback(err);
			callback(null, {
				modules: count,
				updated: meta && meta.updated || new Date(0)
			});
		});
	});
};

exports.createReadStream = function() { // TODO: maybe populate the cache with this stream?
	return mongo.modules.find.apply(mongo.modules, arguments);
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
					mongo.modules.findOne({_id:module._id}, function(err, stale) {
						if (err) return callback(err);
						mongo.modules.save(module, function(err) {
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

				mongo.modules.findOne({_id:name}, function(err, dep) {
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
			diff['.'+dep] = 1;
		});
		stale.dependencies.forEach(function(dep) {
			dep = '.'+dep;
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

	var onlastupdated = function(date) {
		pump(
			request('http://registry.npmjs.org/-/_view/browseUpdated?group_level=2&startkey='+encJSON([date])),
			JSONStream.parse('rows.*'),
			stream.transform(function(row, enc, callback) {
				ensureModule(row.key[1], function(err, fresh, stale) {
					if (err) return callback(err);
					if (!stale || !fresh) return callback(null, row.key[0]);

					ensureDependencies(fresh, stale, function() {
						callback(err, row.key[0]);
					});
				});
			}),
			stream.writable(function(updated, enc, callback) {
				mongo.meta.update({_id:'modules'}, {$set:{updated:new Date(updated)}}, {upsert:true}, callback);
			}),
			function(err) {
				ended = true;
				progress.emit('end', err);
			}
		);
	};

	if (opts.updated) {
		onlastupdated(opts.updated);
	} else {
		mongo.meta.findOne({_id:'modules'}, function(err, doc) {
			if (err) return progress.emit('error', err);
			onlastupdated(doc.updated);
		});
	}

	return progress;
};