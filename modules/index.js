var request = require('request');
var pump = require('pump');
var parallel = require('parallel-transform');
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
		if (col[name]) return col[name](callback);

		col[name] = thunky(function(callback) {
			fn(name, callback);
		});

		col[name](callback);
	};
};

exports.info = function(callback) {
	mongo.modules.count(function(err, count) {
		if (err) return callback(err);
		mongo.meta.findOne({_id:'modules'}, function(err, meta) {
			if (err) return callback(err);
			callback(null, {
				modules: count,
				updated: meta.updated
			});
		});
	});
};

exports.createReadStream = function() {
	return mongo.modules.find.apply(mongo.modules, arguments);
};

exports.update = function(opts, callback) {
	if (typeof opts === 'function') return exports.update(null, opts);
	if (!opts) opts = {};
	if (!callback) callback = noop;

	var progress = new EventEmitter();
	var ended = false;

	progress.count = 0;
	progress.on('end', callback);
	progress.on('error', callback);

	opts.maxAge = opts.maxAge || 3600 * 1000;
	opts.optimistic = opts.optimistic !== false;

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
					mongo.modules.save(module, function(err) {
						if (err) return callback(err);
						if (!ended) {
							progress.count++;
							progress.emit('module', module);
						}
						callback();
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

	var onlastupdated = function(date) {
		pump(
			request('http://registry.npmjs.org/-/_view/browseUpdated?group_level=2&startkey='+encJSON([date])),
			JSONStream.parse('rows.*'),
			parallel(10, function(row, callback) {
				ensureModule(row.key[1], function(err) {
					callback(err, row.key[0]);
				});
			}),
			stream.writable(function(updated, enc, callback) {
				mongo.meta.update({_id:'modules'}, {$set:{updated:new Date(updated)}}, {upsert:true}, callback);
			}),
			function(err) {
				ended = true;
				if (err) return progress.emit('error', err);
				progress.emit('end');
			}
		);
	};

	if (opts.updated) {
		onlastupdated(opts.updated);
		return progress;
	}

	mongo.meta.findOne({_id:'modules'}, function(err, doc) {
		if (err) return progress.emit('error', err);
		onlastupdated(doc.updated);
	});

	return progress;
};

if (require.main !== module) return;

var progress = exports.update();
var log = require('single-line-log');

progress.on('module', function(module) {
	log(progress.count, module._id);
});

progress.on('end', function() {
	log('ended');
	mongo.close();
});

progress.on('error', console.log);