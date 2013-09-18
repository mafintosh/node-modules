var modules = require('../modules');
var scores = require('./scores');
var level = require('../level');
var intersect = require('sorted-intersect-stream');
var union = require('sorted-union-stream');
var deleteRange = require('level-delete-range');
var stream = require('stream-wrapper');
var thunky = require('thunky');
var once = require('once');
var pump = require('pump');
var tokenize = require('../tokenize');

stream = stream.defaults({objectMode:true});

exports.nobody = {
	_id: '__nobody__',
	following: {},
	starred: {}
};

var noop = function() {};

var MAX_SCORE = 999999999;
var MAX_SCORE_PAD = MAX_SCORE.toString(36).replace(/./, '0');

var marker = function(name, score) {
	var rank = (MAX_SCORE-score).toString(36);
	return MAX_SCORE_PAD.slice(rank.length) + rank + '-' + name;
};

var encode = function(key) {
	for (var i = 1; i < arguments.length; i++) key += '~'+arguments[i];
	return key;
};

var pack = function(mod, user) { // TODO: maybe optimize this as it is run A LOT
	var author = (mod.github && mod.github.username) || mod.maintainer;
	var relation = (mod.github ? mod.github.dependents : [])
		.filter(function(dep) {
			return dep !== author && (user.following[dep] || user.starred[dep]);
		})
		.sort(function(a, b) {
			return scores.dependent(b, user) - scores.dependent(a, user);
		})
		.slice(0, 5);

	return [
		mod.name,
		scores.module(mod, user),
		!!(user.following[author] || user.starred[author]),
		relation
	];
};

var unpack = function(mod, packed) {
	var gh = mod.github;
	return {
		name: mod._id,
		author: (gh && gh.username) || mod.maintainer,
		profile: (gh && gh.username) ? 'https://github.com/'+gh.username : 'https://npmjs.org/~'+mod.maintainer,
		related: packed[2],
		relation: packed[3],
		score: packed[1],
		stars: gh ? gh.stars : 0,
		dependents: mod.dependents.length,
		description: mod.description,
		url: gh ? gh.url : 'https://npmjs.org/package/'+mod._id,
		marker: marker(mod._id, packed[1])
	};
};

var indexStream = function(user) {
	return stream.transform(function(mod, enc, callback) {
		var self = this;
		var name = mod._id;

		var onindex = function() {
			var username = mod.github && mod.github.username;
			var value = pack(mod, user);
			var score = value[1];

			value = JSON.stringify(value);

			var tokens = tokenize(mod.keywords.join(' ')+' '+mod.description+' '+name+(username ? ' @'+username : ''));

			var keys = tokens.concat('@').map(function(token) {
				return encode(user._id, 'values', token, marker(name, score));
			});

			keys.forEach(function(key) {
				self.push({key:key, value:value});
			});

			var moduleKey = encode(user._id, 'modules', name);

			keys.push(moduleKey);

			self.push({key:moduleKey, value:JSON.stringify(name)});
			self.push({key:encode(user._id, 'keys', name), value:JSON.stringify(keys)});

			callback();
		};

		level.index.get(encode(user._id, 'keys', name), function(err, keys) {
			if (err) return onindex();

			keys.forEach(function(key) {
				self.push({key:key, type:'del'});
			});

			onindex();
		});
	});
};

var diff = function(stale, fresh) {
	var changes = {};

	var check = function(user) {
		if (changes[user]) return;
		if (fresh.following[user] === stale.following[user] && fresh.starred[user] === stale.starred[user]) return;
		changes[user] = true;
	};

	Object.keys(fresh.following).forEach(check);
	Object.keys(fresh.starred).forEach(check);
	Object.keys(stale.following).forEach(check);
	Object.keys(stale.starred).forEach(check);

	return Object.keys(changes);
};

exports.contains = function(user, callback) {
	if (typeof user === 'function') return exports.contains(null, user);
	if (!user) user = exports.nobody;

	// don't spend time JSON parsing since we only want an existence check
	level.index.users.get(user._id, {valueEncoding:'binary'}, function(err) {
		callback(null, !err);
	});
};

var isNobody = function(user) {
	return exports.nobody._id === user._id;
};

var updateNobody = thunky(function(callback) { // we NEED to update the anon index AT LEAST once
	updateUser(exports.nobody, callback);
});

var updateUser = function(user, callback) {
	var generateQuery = function(old) {
		if (isNobody(user) && !old) return {};
		if (isNobody(user)) return {cached: {$gte: new Date(old.cached)}};

		var ors = [];
		var relevant = diff(user, exports.nobody);
		var changes = old ? diff(user, old) : relevant;

		if (changes.length) {
			ors.push({
				'github.username': {$in: changes}
			}, {
				'github.dependents': {$in: changes}
			});
		}
		if (old) {
			ors.push({
				cached: {$gte: new Date(old.cached)},
				'github.username': {$in: relevant}
			}, {
				cached: {$gte: new Date(old.cached)},
				'github.dependents': {$in: relevant}
			});
		}

		return {$or:ors};
	};

	var updates = 0;
	var counter = stream.transform(function(data, enc, callback) {
		updates++;
		callback(null, data);
	});

	level.index.users.get(user._id, function(err, old) {
		pump(
			modules.createReadStream(generateQuery(old)),
			counter,
			indexStream(user),
			level.index.createWriteStream({valueEncoding:'utf-8'}),
			function(err) {
				if (err) return callback(err);
				user.cached = new Date();
				level.index.users.put(user._id, user, function(err) {
					if (err) return callback(err);
					callback(null, updates);
				});
			}
		);
	});
};

exports.update = function(user, callback) {
	if (typeof user === 'function') return exports.update(null, user);
	if (!user) user = exports.nobody;
	if (!callback) callback = noop;

	updateNobody(function() {
		updateUser(user, callback);
	});
};

exports.remove = function(user, callback) {
	if (typeof user === 'function') return exports.remove(null, user);
	if (!user) user = exports.nobody;

	deleteRange(level.index, { // ignore all errs
		start: user._id+'~',
		end: user._id+'~~'
	}, function() {
		level.index.users.del(user._id, function() {
			callback();
		});
	});
};

var take = function(stream, limit, callback) { // move to (or find similar) module
	var results = [];
	var onend = once(function(err) {
		if (err) return callback(err);
		callback(null, results);
	});

	stream.on('data', function(data) {
		results.push(data);
		if (results.length < limit) return;
		stream.destroy();
		onend();
	});

	stream.on('error', onend);
	stream.on('close', onend);
	stream.on('end', onend);
};

var searchUser = function(username, query, opts) {
	if (!opts) opts = {};

	return query
		.map(function(word) {
			var prefix = encode(username, 'values', word);
			return level.index.createReadStream({
				start: prefix+(opts.marker ? '~'+opts.marker+'~' : '~'),
				end: prefix+'~~',
				valueEncoding: 'utf-8'
			});
		})
		.reduce(function(a, b) {
			return intersect(a, b, keyify);
		});
};

var keyify = function(data) {
	return data.key.slice(data.key.lastIndexOf('~')+1);
};

var nameify = function(data) {
	return data.key.slice(data.key.indexOf('-')+1);
};

exports.search = function(user, query, opts, callback) {
	if (typeof opts === 'function') return exports.search(user, query, null, opts);
	if (!user) user = exports.nobody;
	if (!opts) opts = {};

	var limit = opts.limit || 20;
	query = tokenize(query);
	if (!query.length) query = ['@'];

	var userResults = searchUser(user._id, query, opts);

	var toModule = stream.transform(function(result, enc, callback) {
		modules.get(nameify(result), function(err, module) {
			if (err) return callback(err);
			callback(null, unpack(module, JSON.parse(result.value)));
		});
	});

	if (isNobody(user)) return take(pump(userResults, toModule), limit, callback);

	var anonResults = searchUser(exports.nobody._id, query, opts);
	var notUserResults = stream.transform(function(result, enc, callback) {
		level.index.get(encode(user._id, 'modules', nameify(result)), function(err) {
			if (err) return callback(null, result);
			callback();
		});
	});

	var results = pump(
		union(
			pump(anonResults, notUserResults),
			userResults,
			keyify
		),
		toModule
	);

	take(results, limit, callback);
};