var thunky = require('thunky');
var index = require('./search-index');
var getJSON = require('./getJSON');
var db = require('./db');

var noop = function() {};

var page = function(url, callback) {
	var result = [];
	var loop = function(i) {
		getJSON(url+'?page='+i, function(err, list) {
			if (err) return callback(err);
			if (!list.length) return callback(null, result);
			result = result.concat(list);
			loop(i+1);
		});
	};

	loop(1);
};

var fetch = function(username, callback) {
	page('https://api.github.com/users/'+username+'/following', function(err, following) {
		if (err) return callback(err);
		page('https://api.github.com/users/'+username+'/starred', function(err, starred) {
			if (err) return callback(err);

			var res = {};

			res.username = username;
			res.following = {};
			res.starred = {};
			res.updated = new Date();
			res.indexed = false;

			following.forEach(function(user) {
				res.following[user.login] = 1;
			});

			starred.forEach(function(repo) {
				if (repo.owner.type !== 'User') return;
				var username = repo.full_name.split('/')[0];
				if (username === res.username) return;
				res.starred[username] = (res.starred[username] || 0)+1;
			});

			callback(null, res);
		});
	});
};

var User = function(username, state) {
	var self = this;

	this.indexed = !!(state && state.indexed);
	this.fetched = !!state;

	this.json = thunky(function(callback) {
		if (state) return callback(null, state);
		fetch(username, function(err, user) {
			if (err) return callback(err);
			self.fetched = true;
			db.users.put(username, user, function(err) {
				if (err) return callback(err);
				callback(null, user);
			});
		});
	});

	this.index = thunky(function(callback) {
		if (self.indexed) return callback();
		self.json(function(err, user) {
			if (err) return callback(err);
			index.add(user, function(err) {
				if (err) return callback(err);
				self.indexed = user.indexed = true;
				db.users.put(username, user, callback);
			});
		});
	});
};

User.prototype.search = function(query, opts, callback) {
	if (typeof opts === 'function') return this.search(query, null, opts);

	var self = this;

	this.index(function(err) {
		if (err) return callback(err);
		self.json(function(err, user) {
			if (err) return callback(err);
			index.search(user, query, opts, callback);
		});
	});
};

User.prototype.destroy = function(callback) {
	if (!callback) callback = noop;

	this.json(function(err, user) {
		if (err) return callback(err);
		index.remove(user, function(err) {
			if (err) return callback(err);
			db.users.del(user.username, callback);
		});
	});
};

module.exports = function(username, callback) {
	if (typeof username === 'function') return module.exports(null, username);
	if (!username) username = index.nobody.username;

	db.users.get(username, function(err, user) { // TODO: handle non not-there errors
		if (!user && username === index.nobody.username) user = index.nobody;
		callback(null, new User(username, user));
	});
};