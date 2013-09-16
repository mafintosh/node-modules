var thunky = require('thunky');
var once = require('once');
var index = require('./search-index');
var getJSON = require('./getJSON');
var mongo = require('./mongo');

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
	if (!username || username === '__nobody__') {
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

var User = function(username) {
	if (!(this instanceof User)) return new User(username);
	var self = this;
	this.username = username = username || index.nobody._id;
	this.ensure = thunky(function(callback) {
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

};

User.prototype.update = function(callback) {
	if (!callback) callback = noop;

	var self = this;
	fetchAndSave(this.username, function(err, user) {
		if (err) return callback(err);

		self.ensure = thunky(function(callback) {
			index.update(user, function(err) {
				if (err) return callback(err);
				callback(null, user);
			});
		});
		self.ensure(function(err) {
			callback(err);
		});
	});
};

User.prototype.search = function(query, opts, callback) {
	if (typeof opts === 'function') return this.search(query, null, opts);
	this.ensure(function(err, user) {
		if (err) return callback(err);
		index.search(user, query, opts, callback);
	});
};

module.exports = User;

if (require.main !== module) return;

var users = [index.nobody._id, 'kapetan', 'jmosbech', 'mafintosh', 'freeall', 'substack', 'isaacs'];

var loop = function() {
	var username = users.shift();
	if (!username) process.exit(0);
	var t = Date.now();
	User(username).search('test framework', function() {
		console.log('fetch+index+search for '+username+': '+(Date.now()-t)+'ms');
		loop();
	});
};

loop();