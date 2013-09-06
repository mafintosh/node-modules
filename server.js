var root = require('root');
var send = require('send');
var pejs = require('pejs');
var LRU = require('lru-cache');
var cookie = require('cookie');
var fs = require('fs');
var JSONStream = require('JSONStream');
var pump = require('pump');
var req = require('request');
var qs = require('querystring');
var ansi = require('./ansi');
var registry = require('./registry');
var users = require('./users');
var db = require('./db');

var COOKIE_MAX_AGE = 31 * 24 * 3600 * 1000; // 1 month
var PRODUCTION = process.env.NODE_ENV === 'production';
var REVISION_HEAD = __dirname+'/.git/refs/heads/master';
var REVISION = PRODUCTION && fs.existsSync(REVISION_HEAD) && fs.readFileSync(REVISION_HEAD, 'utf-8').trim();
var DEFAULT_LIMIT = 20;
var GITHUB_CLIENT_ID = '6eda13aad78e1b1c4f5f';
var GITHUB_SECRET = process.env.GITHUB_SECRET;

var app = root();
var cache = LRU(5000);

var fingerprint = function(url) {
	return REVISION ? 'http://dzdv0sfntaeum.cloudfront.net/'+REVISION+url : url;
};

pejs.compress = true;
app.use('response.render', function(filename, locals) {
	var response = this;
	locals = locals || {};
	locals.username = this.request.username;
	locals.fingerprint = fingerprint;
	locals.query = this.request.query.q || '';
	locals.githubClientId = GITHUB_CLIENT_ID;
	pejs.render(filename, locals, function(err, html) {
		if (err) return response.error(500, err.stack);
		response.send(html);
	});
});

app.get('/public/*', function(request, response) {
	send(request, __dirname+'/public/'+request.params.glob).pipe(response);
});

app.get('/{rev}/public/*', function(request, response) {
	var maxAge = 365 * 24 * 3600;
	response.setHeader('Expires', new Date(Date.now() + maxAge * 1000).toGMTString());
	response.setHeader('Cache-Control', 'public, max-age='+maxAge);
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
	db.modules.meta.get('count', function(err, count) {
		if (err) return response.error(err);
		response.render('index.html', {modules:count});
	});
});

app.get('/users.json', function(request, response) {
	response.setHeader('Content-Type', 'application/json; charset=utf-8');
	pump(db.users.createKeyStream(), JSONStream.stringify(), response);
});

app.get('/registry/update', function(request, response) {
	// TODO: progress reports, user updates
	request.connection.setTimeout(30*60*1000);
	registry.update(function(err, stats) {
		if (err) return response.error(err);
		response.send(stats);
	});
});

app.get('/registry/modules/{name}', function(request, response) {
	db.modules.get(request.params.name, function(err, module) {
		if (err) return response.error(err);
		response.send(module);
	});
});

app.get('/search.json', function(request, response) {
	var marker = request.query.marker;
	var query = request.query.q || '';
	var limit = parseInt(request.query.limit, 10) || DEFAULT_LIMIT;

	request.user.search(query, {limit:limit, marker:marker}, function(err, modules) {
		if (err) {
			response.statusCode = 500;
			response.send({error:err.message});
			return;
		}
		response.send(modules);
	})
});

app.get('/search.ansi', function(request, response) {
	var query = request.query.q || '';
	var limit = parseInt(request.query.limit, 10) || DEFAULT_LIMIT;

	request.user.search(query, {limit:limit}, function(err, modules) {
		if (err) return response.error(500, '(error)'.red+' - '+err.message);
		response.setHeader('Content-Type', 'text/plain; charset=utf-8');
		response.send(modules.map(ansi).join('\n')+'\n');
	});
});

app.get('/search', function(request, response) { // no limit option as we autoscroll
	var query = '' + [request.query.q];
	var view = request.query.partial ? 'partials/modules.html' : 'search.html';
	var force = request.query.force || request.query.partial;
	var marker = request.query.marker;
	var warning = !marker; // if marker we already found something...

	if (!force && !request.user.indexed) return response.render('search.html', {query:query, warning:warning});

	request.user.search(query, {limit:DEFAULT_LIMIT, marker:marker}, function(err, modules) {
		if (err) return response.error(err);

		response.render(view, {modules:modules, query:query, warning:warning});
	});
});

app.get('/authorize', function(request, response) {
	req.post({
		url: 'https://github.com/login/oauth/access_token',
		form: {
			client_id: GITHUB_CLIENT_ID,
			client_secret: GITHUB_SECRET,
			code: request.query.code
		}
	}, function(err, res, body) {
		if (err) return response.error(err);
		var access_token = qs.parse(body).access_token;

		req('https://api.github.com/user?access_token='+access_token, function(err, res, body) {
			if (err) return response.error(err);
			var user = JSON.parse(body);
			var login = user.login;

			response.statusCode = 302;
			response.setHeader('Location', 'http://node-modules.com/search?q='+request.query.q+'&u='+login);
			response.end();
		});
	});
});

app.get('/about', function(request, response) {
	response.render('about.html');
});

app.get('/mission', function(request, response) {
	response.render('mission.html');
});

app.error(404, function(request, response) {
	response.render('error.html', {title:'404 Not Found', message: 'We cannot find the page you are looking for'});
});

app.error(function(request, response, opt) {
	if (opt.error) console.error(opt.error.stack);
	response.render('error.html', {title:'Something bad happened', message:opt.message || 'Unknown error'});
});

app.listen(process.env.PORT || 10000);