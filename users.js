var thunky = require('thunky');
var once = require('once');
var LRU = require('lru-cache');
var stream = require('stream-wrapper');
var pump = require('pump');
var EventEmitter = require('events').EventEmitter;
var index = require('./search-index');
var getJSON = require('./getJSON');
var mongo = require('./mongo');

stream = stream.defaults({objectMode:true});

var cache = new LRU(10000); // TODO: find data-driven configs for caching

var noop = function() {};

var page = function(url, callback) {
	var result = [];
	var loop = function(i) {
		getJSON(url+'?page='+i, function(err, list) {
			if (err) return callback(err);
			if (!list.length) return callback(null, result);
			result = result.concat(list);
			if (list.length < 30) return callback(null, result);
			loop(i+1);
		});
	};

	loop(1);
};

var fetch = function(username, callback) {
	if (!username || username === index.nobody._id) {
		return callback(null, {_id:index.nobody._id, following:{}, starred:{}, cached:new Date()});
	}

	callback = once(callback);

	var res = {};

	res._id = username;
	res.cached = new Date();

	page('https://api.github.com/users/'+username+'/following', function(err, following) {
		if (err) return callback(err);

		res.following = {};
		res.following[username] = 1;
		following.forEach(function(user) {
			res.following[user.login] = 1;
		});

		if (res.starred) return callback(null, res);
	});
	page('https://api.github.com/users/'+username+'/starred', function(err, starred) {
		if (err) return callback(err);

		res.starred = {};
		starred.forEach(function(repo) {
			if (repo.owner.type !== 'User') return;
			var username = repo.full_name.split('/')[0];
			if (username === res._id) return;
			res.starred[username] = (res.starred[username] || 0)+1;
		});

		if (res.following) return callback(null, res);
	});
};

var fetchAndSave = function(username, callback) {
	fetch(username, function(err, user) {
		if (err) return callback(err);
		mongo.users.save(user, function(err) {
			if (err) return callback(err);
			callback(null, user);
		});
	});
};

var fetchAndIndex = function(username, callback) {
	fetchAndSave(username, function(err, user) {
		if (err) return callback(err);
		index.update(user, function(err) {
			if (err) return callback(err);
			callback(null, user);
		});
	});
};

var updateUser = function(username, callback) {
	fetchAndSave(username, function(err, user) {
		if (err) return callback(err);

		var ready = function() {
			var get = thunky(function(callback) {
				index.update(user, function(err, updates) {
					if (err) return callback(err);
					user.updates = updates;
					callback(null, user);
				});
			});

			cache.set(username, get);
			get(callback);
		};

		if (!cache.has(username)) return ready();
		cache.get(username)(ready);
	});
};

exports.update = function(callback) {
	var progress = new EventEmitter();

	pump(
		mongo.users.find({}, {_id:1}),
		stream.transform(function(user, enc, callback) {
			updateUser(user._id, callback);
		}),
		stream.writable(function(user, enc, callback) {
			progress.emit('user', user);
			callback();
		}),
		function(err) {
			progress.emit('end', err);
		}
	);

	return progress;
};

exports.createReadStream = function() {
	return mongo.users.find().apply(mongo.users, arguments);
};

exports.info = function() {
	mongo.users.count(function(err, count) {
		callback(null, {users:count});
	});
};

exports.get = function(username, callback) {
	if (!username) username = index.nobody._id;
	if (cache.has(username)) return cache.get(username)(callback);

	var get = thunky(function(callback) {
		mongo.users.findOne({_id:username}, function(err, user) {
			if (!user) return fetchAndIndex(username, callback);
			index.contains(user, function(err, contains) {
				if (contains) return callback(null, user);
				index.update(user, function(err) {
					if (err) return callback(err);
					callback(null, user);
				});
			});
		});
	});

	cache.set(username, get);
	get(callback);
};

exports.search = function(username, query, opts, callback) {
	if (typeof opts === 'function') return exports.search(username, query, null, opts);
	if (!opts) opts = {};

	exports.get(username, function(err, user) {
		if (err) return callback(err);
		if (!user) return callback(new Error('user not found'));

		index.search(user, query, opts, callback);
	});
};