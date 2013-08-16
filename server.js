var root = require('root');
var send = require('send');
var pejs = require('pejs');
var LRU = require('lru-cache');
var cookie = require('cookie');
var ansi = require('./ansi');
var users = require('./users');
var db = require('./db');

var COOKIE_MAX_AGE = 31 * 24 * 3600 * 1000; // 1 month

var app = root();
var cache = LRU(5000);

var search = function(request, callback) {
	var q = request.query.q || '';
	var limit = parseInt(request.query.limit || 50, 10);
	request.user.search(q, {limit:limit}, callback);
};

var fingerprint = function(url) {
	return url;
};

pejs.compress = true;
app.use('response.render', function(filename, locals) {
	var response = this;
	locals = locals || {};
	locals.username = this.request.username;
	locals.fingerprint = fingerprint;
	pejs.render(filename, locals, function(err, html) {
		if (err) return response.error(500, err.stack);
		response.send(html);
	});
});

app.get('/public/*', function(request, response) {
	send(request, __dirname+'/public/'+request.params.glob).pipe(response);
});

app.all(function(request, response, next) {
	var c = cookie.parse(request.headers.cookie || '');
	var username = request.query.u || c.username || '';
	if (request.query.u === '') username = '';

	username = username.toLowerCase();
	request.username = username;
	request.user = cache.get(username);
	response.setHeader('Set-Cookie', cookie.serialize('username', request.username, {maxAge:COOKIE_MAX_AGE}));

	if (request.user) return next();

	users(username, function(err, user) {
		if (err) return next(err);

		request.user = user;
		cache.set(username, user);
		next();
	});
});

app.get('/', function(request, response) {
	db.meta.get('modules', function(err, modules) {
		if (err) return response.error(err);
		response.render('index.html', {modules:modules});
	});
});

app.get('/search.ansi', function(request, response) {
	search(request, function(err, modules) {
		if (err) return response.error(500, '(error)'.red+' - '+err.message);
		response.setHeader('Content-Type', 'text/plain; charset=utf-8');
		response.send(modules.map(ansi).join('\n')+'\n');
	});
});

app.get('/search', function(request, response) {
	var query = request.query.q || '';
	var view = request.query.partial ? 'modules.html' : 'search.html';
	var force = request.query.force;

	if (!force && !request.user.indexed) return response.render('search.html', {query:query});

	search(request, function(err, modules) {
		if (err) return response.error(err);
		response.render(view, {modules:modules, query:query});
	});
});

app.error(404, function(request, response) {
	response.render('error.html', {title:'404 Not Found', message: 'We cannot find the page you are looking for'});
});

app.error(function(request, response, opt) {
	if (opt.error) console.error(opt.error.stack);
	response.render('error.html', {title:'Something bad happened', message:opt.message || 'Unknown error'});
});

app.listen(10000);