var intersect = require('sorted-intersect-stream');
var deleteRange = require('level-delete-range');
var stream = require('stream-wrapper');
var once = require('once');
var pump = require('pump');
var db = require('./db');
var tokenize = require('./tokenize');

stream = stream.defaults({objectMode:true});

var noop = function() {};

var SCORE_FOLLOWING_MAINTAINER = 500;
var SCORE_FOLLOWING_DEPENDENT = 250;
var SCORE_STARRED_MAINTAINER = 200;
var SCORE_STARRED_DEPENDENT = 100;
var SCORE_DEPENDENT = 2;
var SCORE_STAR = 1;

var MAX_STARS_OUTDATED = 1000;
var MAX_SCORE = 999999999;
var MAX_SCORE_PAD = MAX_SCORE.toString(36).replace(/./, '0');

var OUTDATED = 365 * 24 * 3600 * 1000; // 1 year

var modules = {};

var outdated = function(mod) {
	return mod.updated < new Date(Date.now() - OUTDATED).toISOString();
};

var dependentScore = function(dep, user) {
	return (user.following[dep] ? 10 : 0) + (user.starred[dep] || 0);
};

var moduleScore = function(mod, user) {
	var total = 0;
	var gh = mod.github;
	total += mod.dependents.length * SCORE_DEPENDENT;

	if (!gh) return total;

	var stars = gh.stars;
	if (!gh.maintainer) stars = 0;
	if (stars > MAX_STARS_OUTDATED && outdated(mod)) stars = MAX_STARS_OUTDATED;
	total += stars * SCORE_STAR;

	var following = function(other) {
		return user.following[other];
	};

	gh.dependents.forEach(function(dep) {
		if (following(dep))    total += SCORE_FOLLOWING_DEPENDENT;
		if (user.starred[dep]) total += SCORE_FOLLOWING_DEPENDENT * user.starred[dep];
	});

	var username = gh.username;
	if (!username) return total;

	if (following(username))    total += SCORE_FOLLOWING_MAINTAINER;
	if (user.starred[username]) total += SCORE_STARRED_MAINTAINER * user.starred[username];

	return total;
};

var marker = function(name, score) {
	var rank = (MAX_SCORE-score).toString(36);
	return MAX_SCORE_PAD.slice(rank.length) + rank + '-' + name;
};

var unpack = function(packed) {
	var mod = modules[packed[0]];
	var gh = mod.github;
	return {
		name: mod.name,
		author: (gh && gh.username) || mod.maintainer,
		profile: (gh && gh.username) ? 'https://github.com/'+gh.username : 'https://npmjs.org/~'+mod.maintainer,
		related: packed[2],
		relation: packed[3],
		score: packed[1],
		stars: gh ? gh.stars : 0,
		dependents: mod.dependents.length,
		description: mod.description,
		url: gh ? gh.url : 'https://npmjs.org/package/'+mod.name,
		marker: marker(mod.name, packed[1])
	};
};

var pack = function(mod, user) {
	var author = (mod.github && mod.github.username) || mod.maintainer;
	var relation = (mod.github ? mod.github.dependents : [])
		.filter(function(dep) {
			return dep !== author && (user.following[dep] || user.starred[dep]);
		})
		.sort(function(a, b) {
			return dependentScore(b, user) - dependentScore(a, user);
		})
		.slice(0, 5);

	return [
		mod.name,
		moduleScore(mod, user),
		!!(user.following[author] || user.starred[author]),
		relation
	];
};

var encode = function(key) {
	for (var i = 1; i < arguments.length; i++) key += '~'+arguments[i];
	return key;
};

var keyify = function(data) {
	return data.key.slice(data.key.lastIndexOf('~')+1);
};

var unpackAll = function(packed, callback) {
	var waiting = 0;

	packed.forEach(function(pack) {
		if (modules[pack[0]]) return;
		waiting++;
		db.modules.get(pack[0], function(err, mod) {
			if (err) callback(err);
			modules[pack[0]] = mod;
			if (--waiting) return;
			callback(null, packed.map(unpack));
		});
	});

	if (!waiting) return callback(null, packed.map(unpack));
	callback = once(callback); // once it if we do async stuff to help with error handling
};

exports.nobody = {
	username: '',
	following: {},
	starred: {}
};

exports.remove = function(user, callback) {
	if (!callback) callback = noop;
	if (!user) user = exports.nobody;

	deleteRange(db.index, {
		start: encode(user.username)+'~',
		end: encode(user.username)+'~~'
	}, callback);
};

var indexStream = function(user) {
	return stream.transform(function(mod, enc, callback) {
		var self = this;
		var name = mod.name;

		var onindex = function() {
			var username = mod.github && mod.github.username;
			var value = pack(mod, user);
			var score = value[1];

			modules[name] = mod; // let's populate the cache while we're at it
			value = JSON.stringify(value);

			var tokens = tokenize(mod.keywords.join(' ')+' '+mod.description+' '+name+(username ? ' @'+username : ''));

			var keys = tokens.concat('@').map(function(token) {
				return encode(user.username, 'values', token, marker(name, score));
			});

			keys.forEach(function(key) {
				self.push({key:key, value:value});
			});

			self.push({key:encode(user.username, 'keys', name), value:JSON.stringify(keys)});
			callback();
		};

		db.index.get(encode(user.username, 'keys', name), function(err, keys) {
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

exports.update = function(user, opts, callback) {
	if (typeof opts === 'function') return exports.update(user, null, opts);
	if (!callback) callback = noop;
	if (!user) user = exports.nobody;
	if (!opts) opts = {};

	if (!opts.updated && !opts.stale) return exports.add(user, callback);

	var updated = opts.updated || new Date(0);
	if (typeof updated !== 'string') updated = updated.toISOString();

	pump(
		db.modules.cached.createValueStream({start:updated}),
		stream.transform(function(name, enc, callback) {
			db.modules.get(name, callback);
		}),
		indexStream(user),
		db.index.createWriteStream({valueEncoding:'utf-8'}),
		callback
	);
};

exports.add = function(user, callback) { // TODO: profile to see if we can get away with just using update all the time
	if (!callback) callback = noop;
	if (!user) user = exports.nobody;

	pump(
		db.modules.createValueStream(),
		indexStream(user),
		db.index.createWriteStream({valueEncoding:'utf-8'}),
		callback
	);
};

exports.search = function(user, query, opts, callback) {
	if (typeof opts === 'function')  return exports.search(user, query, null, opts);
	if (!user) user = exports.nobody;

	query = tokenize(query);

	if (!opts) opts = {};
	if (!query.length) query = ['@'];

	var stream = query
		.map(function(word) {
			var prefix = encode(user.username, 'values', word);
			return db.index.createReadStream({
				start: prefix+(opts.marker ? '~'+opts.marker+'~' : '~'),
				end: prefix+'~~',
				valueEncoding: 'utf-8'
			});
		})
		.reduce(function(result, stream) {
			return intersect(result, stream, keyify);
		});

	var result = [];
	var limit = opts.limit || 20;

	var onend = once(function(err) {
		if (err) return callback(err);
		unpackAll(result, callback);
	});

	stream.on('data', function(data) {
		result.push(JSON.parse(data.value));
		if (result.length < limit) return;
		stream.destroy();
		onend();
	});

	stream.on('close', onend);
	stream.on('error', onend);
	stream.on('end', onend);
};