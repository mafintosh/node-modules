var StringDecoder = require('string_decoder').StringDecoder;
var util = require('util');
var url = require('url');
var qs = require('querystring');

var parsers = {};

parsers.body = function(request, response) {
	var decoder = new StringDecoder();
	var buf = '';

	request.on('data', function(data) {
		buf += decoder.write(data);
	});
	request.on('end', function() {
		request.emit('body', buf);
	});
};
parsers.json = function(request, response) {
	request.on('body', function(body) {
		try {
			body = JSON.parse(body);
		} catch (err) {
			return response.error(400, 'could not parse json');
		}
		request.emit('json', body || {});
	});
};
parsers.form = function(request, response) {
	request.on('body', function(body) {
		request.emit('form', qs.parse(body));
	});
};

var onparser = function(name) {
	if (!parsers[name]) return;
	if (this.parsing[name]) return;
	this.parsing[name] = true;
	parsers[name](this, this.response);
};
var parseURL = function(request) {
	return request._url || (request._url = url.parse(request.url, true));
};

module.exports = function(app) {
	app.use('request.query', {getter:true}, function() {
		return parseURL(this).query;
	});
	app.use('response.send', function(body) {
		var type = this.getHeader('Content-Type');
		body = body || '';

		if (Buffer.isBuffer(body)) {
			this.setHeader('Content-Length', body.length);
			this.end(body);
			return;
		}

		if (typeof body === 'string') {
			type = type || 'text/html; charset=utf-8';
		}
		if (typeof body === 'object') {
			body = JSON.stringify(body);
			type = type || 'application/json; charset=utf-8';
		}

		this.setHeader('Content-Type', type);
		this.setHeader('Content-Length', Buffer.byteLength(body));
		this.end(body);
	});
	app.use('response.redirect', function(location) {
		this.statusCode = 302;
		var host = this.request.headers.host;

		if (location.indexOf('://') === -1 || !host) {
			this.setHeader('Location', location);
			this.end();
			return;
		}

		var connection = this.request.connection;
		var protocol = connection && connection.encrypted ? 'https' : 'http';

		this.setHeader(protocol+'://'+host+location);
		this.end();
	});
	app.use('response.error', function(statusCode, message) {
		var options = {};

		if (typeof statusCode !== 'number') {
			message = statusCode;
			statusCode = 500;
		}

		if (util.isError(message)) {
			options.error = message;
			options.stack = options.error.stack;
			message = options.error.message;
		}

		options.message = message;
		options.statusCode = this.statusCode = statusCode;

		app.catch(this.request, this, options);
	});

	app.on('route', function(request, response) {
		request.parsing = request.parsing || {};
		request.on('newListener', onparser);
	});
};