var request = require('request');
var db = require('./db');

var GITHUB_USER = {client_id:'5859679ea29a64c21b0d', client_secret:'fe128ece9aef6119b40825211041eaca43842da9'};
var GITHUB_URL = /^https:\/\/api.github.com/;

module.exports = function(url, opts, callback) {
	if (typeof opts === 'function') return module.exports(url, {}, opts);

	db.etags.get(url, function(_, data) {
		if (opts.force) data = null;

		if (data && opts.optimistic) { // status requests probably never change...
			if (data.body === null) return callback(new Error('bad request'));
			if (data.body === true) return callback(null, data.body);
		}

		if (data && Date.now() - data.updated < opts.maxAge) {
			if (data.body === null) return callback(new Error('bad request'));
			return callback(null, data.body);
		}

		request(url, {
			json:true,
			qs: GITHUB_URL.test(url) && GITHUB_USER,
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

			db.etags.put(url, data, function() {
				if (body === null) return callback(new Error('bad request'));
				return callback(null, body);
			});
		});
	});
};