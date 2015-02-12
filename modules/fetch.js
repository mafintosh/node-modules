var getJSON = require('../getJSON');

var RATE_LIMIT_RETRY = 10*60*1000; // ten minutes // TODO: make this an option instead

var noop = function() {};

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

var lookup = function(name, opts, callback) {
	if (typeof opts === 'function') return lookup(name, null, opts);
	if (!opts) opts = {};

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
			getJSONRetry('https://api.github.com/repos/'+repository+'/contributors', function(err, collabs) {
				var collab = collabs && collabs.some(function (c) {
					return c.login === username;
				});

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
			if (!npm.versions[cur]) return min;
			if (!npm.versions[min]) return cur;
			return npm.time[min] < npm.time[cur] ? min : cur;
		});
		var max = versions.reduce(function(max, cur) {
			if (!npm.versions[cur]) return max;
			if (!npm.versions[max]) return cur;
			return npm.time[max] > npm.time[cur] ? max : cur;
		});

		mod._id = name;
		mod.version = max;
		mod.maintainer = maintainers[0].name;
		mod.created = new Date(npm.time[min]);
		mod.updated = new Date(npm.time[max]);
		mod.cached = new Date();

		npm = npm.versions[max];
		if (!npm) return callback();

		mod.url = 'https://npmjs.org/package/'+enc(name);
		mod.description = npm.description || '';
		mod.keywords = parseKeywords(npm.keywords || npm.tags || []);

		mod.dependencies = npm.dependencies ? Object.keys(npm.dependencies) : [];

		var deps = 'http://registry.npmjs.org/-/_view/dependedUpon?startkey='+encJSON([name])+'&endkey='+encJSON([name, {}])+'&group_level=2';

		getJSONRetry(deps, function(err, result) {
			if (err) return callback(err);

			mod.dependents = result.rows.map(function(row) {
				return row.key[1];
			});

			findRepository(maintainers, repository, function(err, github) {
				if (!github) return callback(null, mod);
				mod.github = github;
				callback(null, mod);
			});
		});
	});
};

module.exports = lookup;