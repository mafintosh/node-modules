var request = require('request');
var parallel = require('parallel-transform');
var JSONStream = require('JSONStream');
var pump = require('pump');
var stream = require('stream-wrapper');
var EventEmitter = require('events').EventEmitter;
var getJSON = require('./getJSON');
var db = require('./db');

var MAX_PARALLEL = 25;
var RATE_LIMIT_RETRY = 10*60*1000; // ten minutes // TODO: make this an option instead

stream = stream.defaults({objectMode:true});

var noop = function() {};

var ioerr = function(err) {
	return err && err.name !== 'NotFoundError';
};

var enc = encodeURIComponent;
var encJSON = function(data) {
	return enc(JSON.stringify(data));
};

var parseRepository = function(repo) {
	if (typeof repo === 'object' && repo) return parseRepository(repo.url);
	if (typeof repo !== 'string' || repo.indexOf('github.com') === -1) return '';
	return repo.split('#')[0].replace(/\.git$/i, '').split('/').slice(-2).join('/').split(':').pop();
};

var parseKeywords = function(keywords) {
	if (typeof keywords === 'string') keywords = keywords.split(/\s+/);
	if (!Array.isArray(keywords)) keywords = Object.keys(keywords || {});

	var uniq = {};
	keywords.forEach(function(word) {
		uniq[word.toLowerCase()] = true;
	});

	return Object.keys(uniq);
};

var fetchModule = function(name, opts, callback) {
	var getJSONRetry = function(url, callback) {
		getJSON(url, opts, function(err, body, rateLimited) {
			if (rateLimited) return setTimeout(getJSONRetry.bind(this, url, callback), RATE_LIMIT_RETRY);
			callback(err, body);
		});
	};

	var findRepository = function(maintainers, repository, callback) {
		if (!maintainers.length) return callback();

		var maintainer = maintainers.shift().name;

		var next = function() {
			findRepository(maintainers, repository, callback);
		};

		var ongithubuser = function(username, repository) {
			if (repository) return onrepository(username, repository);
			getJSONRetry('https://api.github.com/repos/'+enc(username)+'/'+enc(name), function(err, repo) {
				if (repo) return onrepository(username, repo.full_name);
				getJSONRetry('https://api.github.com/repos/'+enc(username)+'/'+enc('node-'+name), function(err, repo) {
					if (repo) return onrepository(username, repo.full_name);
					next();
				});
			});
		};

		var onrepository = function(username, repository) {
			getJSONRetry('https://api.github.com/repos/'+repository+'/collaborators/'+username, function(err, collab) {
				getJSONRetry('https://api.github.com/repos/'+repository, function(err, repo) {
					if (err) return next();
					if (!collab && maintainers.length) return next();

					callback(null, {
						username: username,
						repository: repository,
						url: 'https://github.com/'+repository,
						maintainer: !!collab,
						stars: repo.watchers
					});
				});
			});
		};

		getJSONRetry('http://registry.npmjs.org/-/user/org.couchdb.user:'+enc(maintainer), function(err, user) {
			if (err) return next(); // deleted user
			if (user.github) return ongithubuser(user.github.replace(/\/$/, '').split('/').pop(), repository);

			getJSONRetry('https://api.github.com/legacy/user/email/'+enc(user.email), function(err, result) {
				if (result) return ongithubuser(result.user.login, repository);

				getJSONRetry('https://api.github.com/users/'+enc(user.name), function(err, result) {
					if (result) return ongithubuser(result.login, repository);
					if (repository) return onrepository(null, repository);

					next();
				});
			});
		});
	};

	getJSONRetry('http://registry.npmjs.org/'+enc(name), function(err, npm) {
		if (err) return callback(); // deleted module
		if (!npm.time) return callback();

		var mod = {};
		var repository = parseRepository(npm.repository) || parseRepository(npm.homepage);

		var versions = Object.keys(npm.time);
		var maintainers = npm.maintainers;

		if (!versions.length) return callback();

		var min = versions.reduce(function(min, cur) {
			return npm.time[min] < npm.time[cur] ? min : cur;
		});
		var max = versions.reduce(function(max, cur) {
			return npm.time[max] > npm.time[cur] ? max : cur;
		});

		mod.name = name;
		mod.version = max;
		mod.maintainer = maintainers[0].name;
		mod.created = npm.time[min];
		mod.updated = npm.time[max];

		npm = npm.versions[max];

		mod.url = 'https://npmjs.org/package/'+enc(name);
		mod.description = npm.description || '';
		mod.keywords = parseKeywords(npm.keywords || npm.tags || []);

		mod.dependencies = npm.dependencies ? Object.keys(npm.dependencies) : [];

		findRepository(maintainers, repository, function(err, github) {
			if (!github) return callback(null, mod);
			mod.github = github;
			callback(null, mod);
		});
	});

};

var fetchDependents = function(name, opts, callback) {
	var url = 'http://registry.npmjs.org/-/_view/dependedUpon?startkey='+encJSON([name])+'&endkey='+encJSON([name, {}])+'&group_level=2';
	var deps = {};
	var uniq = {};

	getJSON(url, opts, function(err, result) {
		if (err) return callback(err);

		deps.npm = result.rows.map(function(row) {
			return row.key[1];
		});

		var i = 0;
		var loop = function() {
			var name = deps.npm[i++];

			if (!name) {
				deps.github = Object.keys(uniq);
				return callback(null, deps);
			}

			var onmodule = function(mod) {
				if (mod && mod.github && mod.github.username) uniq[mod.github.username] = true;
				loop();
			};

			db.modules.get(name, function(err, mod) {
				if (mod) return onmodule(mod);
				fetchModule(name, opts, function(err, mod) {
					if (err) return callback(err);
					onmodule(mod);
				});
			});
		};

		loop();
	});
};

var lookup = function(name, opts, callback) {
	if (typeof opts === 'function') return lookup(name, null, opts);
	if (!opts) opts = {};

	fetchModule(name, opts, function(err, mod) {
		if (err || !mod) return callback(err);
		mod.cached = new Date().toISOString();
		fetchDependents(name, opts, function(err, deps) {
			if (err) return callback(err);
			mod.dependents = deps.npm;
			if (mod.github) mod.github.dependents = deps.github;
			callback(null, mod);
		});
	});
};

exports.lookup = fetchModule;

var diff = function(prev, cur) {
	var changes = {};

	prev.forEach(function(val) {
		changes[val] = -1;
	});

	cur.forEach(function(val) {
		if (changes[val] === -1) delete changes[val];
		else changes[val] = 1;
	});

	return Object.keys(changes);
};

var update = function(opts, callback) {
	if (typeof opts === 'function') return update(null, opts);
	if (!opts) opts = {};
	if (!callback) callback = noop;

	opts.maxAge = opts.maxAge || 3600 * 1000;
	opts.optimistic = opts.optimistic !== false;

	var total = 0;
	var updated = {}; // a bit none streamish that we have some state here,
	                  // but since theres only ~40k modules we should be fine
	var progress = new EventEmitter();

	progress.count = 0;
	progress.on('end', callback);
	progress.on('error', callback);

	var onupdate = function(name, callback) {
		if (updated[name]) return callback();
		lookup(name, opts, function(err, fresh) {
			if (!fresh) return callback(err);
			db.modules.get(name, function(err, stale) {
				if (ioerr(err)) return callback(err);
				updated[name] = true;
				callback(null, {fresh:fresh, stale:stale});
			});
		});
	};

	var onlastupdate = function(date) {
		pump(
			request('http://registry.npmjs.org/-/_view/browseUpdated?group_level=2&startkey='+encJSON([date])),
			JSONStream.parse('rows.*'),
			parallel(MAX_PARALLEL, function(row, callback) {
				// we need to both fetch the newests published
				// AND update any dependency changes (to update dependents)
				onupdate(row.key[1], function(err, change) {
					if (err) return callback(err);
					if (!change) return callback();

					var deps = diff(change.fresh.dependencies, change.stale ? change.stale.dependencies : []);
					var changes = [];

					var loop = function() {
						if (!deps.length) {
							changes.push(change);
							return callback(null, changes);
						}

						onupdate(deps.pop(), function(err, change) {
							if (err) return callback(err);
							if (!change) return loop();
							changes.push(change);
							loop();
						});
					};

					loop();
				});
			}),
			stream.transform(function(changes, enc, callback) {
				var self = this;
				var mod = db.modules;
				var latest = changes[changes.length-1];

				var push = function(type, key, val) {
					self.push({type:type, key:key, value:val});
				};

				changes.forEach(function(change, i) {
					var fresh = change.fresh;
					var stale = change.stale;

					if (stale) push('del', mod.cached.prefix(stale.cached+'@'+stale.name));
					else push('put', mod.meta.prefix('count'), ++total);

					push('put', mod.cached.prefix(fresh.cached+'@'+fresh.name), fresh.name);
					push('put', mod.prefix(fresh.name), fresh);
				});

				push('put', mod.meta.prefix('updated'), latest.fresh.updated);

				progress.updated = latest.fresh.updated;
				progress.count++;
				progress.emit('update', latest.fresh);

				callback();
			}),
			db.createWriteStream(),
			function(err) {
				if (err) progress.emit('error', err);
				progress.emit('end');
			}
		);
	};

	db.modules.meta.get('count', function(err, num) {
		if (num) total = num;
		if (opts.updated) return onlastupdate(opts.updated);

		db.modules.meta.get('updated', function(err, updated) {
			onlastupdate(updated || new Date(0).toISOString());
		});
	});

	return progress;
};

exports.update = update;

if (require.main !== module) return;

var progress = update();

progress.on('update', function(module) {
	console.log(module.updated, module.name);
});

progress.on('end', function() {
	console.log('end');
});