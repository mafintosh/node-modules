var thunky = require('thunky');
var once = require('once');
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
			if (list.length < 30) return callback(null, result);
			loop(i+1);
		});
	};

	loop(1);
};

var fetch = function(username, callback) {
	callback = once(callback);

	var res = {};

	res.username = username;
	res.updated = new Date();

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
			if (username === res.username) return;
			res.starred[username] = (res.starred[username] || 0)+1;
		});

		if (res.following) return callback(null, res);
	});
};

var User = function(username, json) {
	this.username = username;
	this.indexed = json && json.indexed && new Date(json.indexed);
	this.json = json;
	this.updating = null;
};

User.prototype.update = function(callback) {
	if (!callback) callback = noop;
	if (this.updating) return this.updating(callback);

	var self = this;
	this.updating = thunky(function(callback) {
		fetch(self.username, function(err, json) {
			if (err) return callback(err);

			var now = new Date();
			var stale = self.json;
			self.json = json;

			index.update(json, {updated:self.indexed, stale:stale}, function(err) {
				if (err) return callback(err);
				self.indexed = json.indexed = now;
				db.users.put(self.username, json, callback);
			});
		});
	});

	this.updating(function(err) {
		self.updating = null;
		callback(err);
	});
};

User.prototype.ready = function(fn) {
	if (!this.updating) return fn();
	this.updating(fn);
};

User.prototype.search = function(query, opts, callback) {
	if (typeof opts === 'function') return this.search(query, null, opts);
	if (!callback) callback = noop;

	var self = this;
	if (!this.indexed) this.update();
	this.ready(function(err) {
		if (err) return callback(err);
		index.search(self.json, query, opts, callback);
	});
};

User.prototype.toJSON = function() {
	return this.json;
};

User.prototype.destroy = function(callback) {
	if (!callback) callback = noop;

	var self = this;
	this.ready(function(err) {
		if (err) return callback(err);
		if (!self.json) return callback();
		index.remove(self.json, function(err) {
			if (err) return callback(err);
			db.users.del(self.username, callback);
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