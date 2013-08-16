var protein = require('protein');
var murl = require('murl');
var address = require('network-address');

var METHODS = 'GET POST PUT DELETE PATCH OPTIONS'.split(' ');
var ALIASES = {};

ALIASES.all = METHODS;
METHODS.forEach(function(method) {
	ALIASES[method.toLowerCase().replace('delete', 'del')] = method;
});

var Root = function() {
	this.mixin = protein();
	this.routes = {};
	this.errors = {};
	this.servers = [];

	this.on('request', function(request, response) {
		if (request.method === 'HEAD') {
			request.method = 'GET';
		}
		this.mixin(request, response);
		this.route(request, response);
	});

	this.setMaxListeners(0);
};

Root.prototype.__proto__ = process.EventEmitter.prototype;

Root.prototype.use = function(arg) {
	if (typeof arg === 'function') {
		arg.apply(null, [this].concat(Array.prototype.slice.call(arguments, 1)));
		return this;
	}
	if (typeof arg === 'object') {
		this.all(arg);
		return this;
	}
	this.mixin.use.apply(this.mixin, arguments);
	return this;
};

Root.prototype.fork = function(url, fork) {
	var app = this;
	fork = fork || new Root();

	Array.prototype.concat.apply([], arguments).forEach(function(pattern) {
		if (url[0] === '/') {
			app.all(url.replace(/\/$/, '')+'/*', '/*', function(request, response) {
				fork.route(request, response);
			});
		} else {
			app.all(function(request, response, next) {
				if (!request.headers.host || request.headers.host.split(':')[0] !== url) return next();
				fork.route(request, response);
			});
		}
	});

	return fork;
};

Root.prototype.error = function(pattern, fn) {
	if (typeof pattern === 'function') return this.error('*', pattern);
	this.errors[pattern] = fn;
	return this;
};

var toBuffer = function(data) {
	return typeof data === 'string' ? require('fs').readFileSync(data) : data;
};

var listen = function(server, port) { // uses a hack to avoid cluster random port sharing
	if (port) return server.listen(port);
	var env = process.env;
	var cluster = require('cluster');
	if (cluster.isMaster) return server.listen(0);

	cluster.isWorker = false;
	process.env = {};
	server.listen(0);
	process.env = env;
	cluster.isWorker = true;
};

Root.prototype.listen = function(port, options, callback) {
	if (typeof port !== 'number' && typeof port !== 'string') return this.listen(0, port, options);
	if (typeof options === 'function') return this.listen(port, undefined, options);

	options = options || {};
	options.key = toBuffer(options.key);
	options.cert = toBuffer(options.cert);

	if (callback) {
		this.once('bind', callback);
	}

	var server = options.cert && options.key ? require('https').createServer(options) : require('http').createServer();
	var first = !this.servers.length;
	var self = this;

	server.on('listening', function() {
		self.emit('bind', address()+':'+server.address().port, server);
		if (!first) return;
		self.emit('listening');
	});
	server.on('request', function(request, response) {
		self.emit('request', request, response);
	});
	server.on('error', function(err) {
		self.emit('error', err);
	});

	['upgrade', 'connect'].forEach(function(name) {
		server.on(name, function(request, socket, head) {
			if (!self.listeners(name).length) return socket.destroy();
			self.emit(name, request, socket, head);
		});
	});

	listen(server, port);
	this.servers.push(server);
	return this;
};

Root.prototype.close = function(callback) {
	var waiting = this.servers.length;
	var self = this;

	this.servers.forEach(function(server) {
		server.once('close', function() {
			if (--waiting) return;
			self.emit('close');
		});
		server.close();
	});

	if (!callback) return this;

	this.once('close', callback);
	return this;
};

var normalizeURL = function(url) { // require('url').resolve seems to re-encode the url :(
	var skip = 0;

	return url.split('/').reduceRight(function(result, part, i) {
		if (result === '..') {
			skip++;
			result = '';
		}
		if (part === '..' && i) {
			skip++;
			return result;
		}
		if (skip && i) {
			skip--;
			return result;
		}
		return part+'/'+result;
	});
};

var decodeURL = function(url) {
	var index = url.indexOf('?');
	url = index === -1 ? url : url.substring(0, index);

	try {
		url = decodeURIComponent(url);
	} catch (err) {
		return null;
	}

	return url.indexOf('/..') === -1 ? url : normalizeURL(url);
};

Root.prototype.matches = function(request) {
	var url = decodeURL(request.url);

	return (this.routes[request.method] || []).some(function(entry) {
		return entry.pattern(url);
	});
};

Root.prototype.route = function(request, response, callback) {
	this.emit('route', request, response);

	var i = -1;
	var entries = this.routes[request.method];
	var url = decodeURL(request.url);

	if (!url) return response.error(400, 'url is malformed');

	callback = callback || function(err, message) {
		if (err) return response.error(err, message);
		response.error(404, 'cannot find '+url);
	};

	var loop = function(err) {
		if (err) return callback(err);
		for (i++; i < entries.length && !(request.params = entries[i].pattern(url)); i++);
		if (!entries[i]) return callback();

		entries[i].fn(request, response, loop);
	};

	entries ? loop() : callback();
};

var handleError = function(request, response, options) {
	response.setHeader('Content-Type', 'text/plain');
	response.end(options.stack || options.message || '');
};

Root.prototype.catch = function(request, response, options) {
	(this.errors[response.statusCode] || this.errors[(''+response.statusCode)[0]+'xx'] || this.errors['*'] || handleError)(request, response, options);
};

var rewriter = function(app, pattern, fn) {
	pattern = murl(pattern);
	fn = fn || function(request, response) {
		app.route(request, response);
	};

	return function(request, response, next) {
		var index = request.url.indexOf('?');
		request.url = encodeURI(pattern(request.params)) + (index === -1 ? '' : request.url.substring(index));
		request._url = undefined; // reset cache
		fn(request, response, next);
	};
};

var addRoute = function(app, methods, pattern, fn) {
	var entry = {};

	entry.pattern = murl(pattern);
	entry.fn = fn;

	[].concat(methods).forEach(function(method) {
		app.routes[method] = app.routes[method] || [];
		app.routes[method].push(entry);
	});
};

Object.keys(ALIASES).forEach(function(alias) {
	var isFunction = function(fn) {
		return typeof (fn && fn.route || fn) === 'function';
	};

	Root.prototype[alias] = function(pattern, rewrite, fn) {
		if (isFunction(pattern)) return this[alias](undefined, undefined, pattern);
		if (isFunction(rewrite)) return this[alias](pattern, undefined, rewrite);

		if (fn && fn.route) {
			fn = fn.route.bind(fn);
		}
		if (rewrite) {
			fn = rewriter(this, rewrite, fn);
		}

		addRoute(this, ALIASES[alias], pattern, fn);
		return this;
	};
});

module.exports = function() {
	return new Root().use(require('./defaults'));
};