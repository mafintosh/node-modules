var request = require('request');
var ForeverAgent = require('forever-agent');
var param = require('param');
var level = require('./level');

var GITHUB_USER = {client_id:param('github.client'), client_secret:param('github.secret')};
var GITHUB_URL = /^https:\/\/api.github.com/;
var HTTP_URL = /^http:/;
var AGENT_SSL = new ForeverAgent.SSL();

var githubRequest = request.defaults({
	qs: GITHUB_USER,
	agent: AGENT_SSL
});

var httpRequest = request.defaults({
	agent: new ForeverAgent()
});

var matchRequest = function(url) {
	if (GITHUB_URL.test(url)) return githubRequest;
	if (HTTP_URL.test(url)) return httpRequest;
	return request;
};

module.exports = function(url, opts, callback) {
	if (typeof opts === 'function') return module.exports(url, {}, opts);

	level.etags.get(url, function(_, data) {
		if (opts.force) data = null;

		if (data && opts.optimistic) { // status requests probably never change...
			if (data.body === null) return callback(new Error('bad request'));
			if (data.body === true) return callback(null, data.body);
		}

		if (data && Date.now() - data.updated < opts.maxAge) {
			if (data.body === null) return callback(new Error('bad request'));
			return callback(null, data.body);
		}

		matchRequest(url)(url, {
			json:true,
			headers: {
				'user-agent': 'node-search',
				'if-none-match': data && data.etag
			}
		}, function(err, response, body) {
			if (err) return callback(err);

			var status = response.statusCode;

			if (status >= 400 && response.headers['x-ratelimit-remaining'] === '0') return callback(new Error('ratelimited'), null, true);
			if (status >= 400) body = null;

			if (status === 304) body = data.body;
			if (status === 204) body = true;

			data = {};
			data.body = body;
			data.etag = response.headers.etag;
			data.updated = Date.now();

			level.etags.put(url, data, function() {
				if (body === null) return callback(new Error('bad request'));
				return callback(null, body);
			});
		});
	});
};