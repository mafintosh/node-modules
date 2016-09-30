var root = require('root');
var pejs = require('pejs');
var send = require('send');
var cookie = require('cookie');
var param = require('param');
var fs = require('fs');
var req = require('request');
var qs = require('querystring');
var JSONStream = require('JSONStream');
var pump = require('pump');
var modules = require('./modules');
var users = require('./users');
var update = require('./update');

var COOKIE_MAX_AGE = 31 * 24 * 3600 * 1000; // 1 month
var FINGERPRINT_MAX_AGE = 365 * 24 * 3600;
var FINGERPRINT = param('fingerprint') && param('fingerprint').toString().trim();

var app = root();
var views = pejs({
	compress: true
});

var string = function(str) {
	return str ? str+'' : '';
};

var fingerprint = function(url) {
	return FINGERPRINT ? 'http://dzdv0sfntaeum.cloudfront.net/'+FINGERPRINT+url : url;
};

app.use('response.render', function(filename, locals) {
	var response = this;

	locals = locals || {};
	locals.anon = !this.request.username;
	locals.username = locals.anon ? '' : this.request.username;
	locals.fingerprint = fingerprint;
	locals.query = string(this.request.query.q);


	views.render(filename, locals, function(err, html) {
		if (err) return response.error(err);
		response.send(html);
	});
});

app.use('request.search', function(callback) {
	var query = string(this.query.q);
	var marker = string(this.query.marker);
	var limit = Math.min(parseInt(this.query.limit, 10) || 20, 50);

	users.search(this.username, query, {marker:marker, limit:limit}, callback);
});

app.on('route', function(request, response) {
	if (request.headers.host === 'blog.node-modules.com') return response.redirect('http://reddit.com/r/node_modules');

	var setCookie = true;
	var c = cookie.parse(request.headers.cookie || '');
	var username = request.query.u || c.username || '';
	if (request.query.u === '') username = '';

	if (request.headers.host.indexOf('.node-modules.com') > -1) {
		setCookie = false;
		username = request.headers.host.split('.')[0];
		if (username === 'development' || username === 'www') username = '';
		if (username) request.userPage = true;
	}

	request.username = username = username.toLowerCase();
	if (setCookie) response.setHeader('Set-Cookie', cookie.serialize('username', username, {maxAge:COOKIE_MAX_AGE}));
	response.setHeader('Access-Control-Allow-Origin', '*');
});

app.get('/package/{name}.json', function(request, response) {
	modules.get(request.params.name, function(err, module) {
		if (err) return response.error(err);
		response.send(module);
	});
});

app.get('/modules.json', function(request, response) {
	var cached = new Date(string(request.query.cached) || '1970-01-01');
	var query = {cached:{$gte:cached}};
	pump(modules.createReadStream(query), JSONStream.stringify(), response);
});

app.get('/update.json', function(request, response) {
	var progress = update();
	var output = JSONStream.stringify();

	response.setHeader('Content-Type', 'application/json; charset=utf-8');
	output.pipe(response);

	progress.on('module', function(module) {
		output.write({type:'module', id:module._id, version:module.version, updated:module.updated});
	});
	progress.on('user', function(user) {
		output.write({type:'user', id:user._id, updates:user.updates});
	});
	progress.on('end', function() {
		output.end();
	});
});

app.get('/me.json', function(request, response) {
	users.get(request.username, function(err, user) {
		if (err) return response.error(err);
		response.send(user);
	});
});

app.get('/search.json', function(request, response) {
	request.search(function(err, results) {
		if (err) return response.error(err);
		response.send(results);
	});
});

app.get('/.json', function(request, response) {
	modules.info(function(err, info) {
		if (err) return response.error(err);
		info.now = new Date();
		response.send(info);
	});
});

app.get('/public/*', function(request, response) {
	send(request, __dirname+'/public/'+request.params.glob).pipe(response);
});

app.get('/{version}/public/*', function(request, response) {
	response.setHeader('Expires', new Date(Date.now() + FINGERPRINT_MAX_AGE * 1000).toGMTString());
	response.setHeader('Cache-Control', 'public, max-age='+FINGERPRINT_MAX_AGE);
	send(request, __dirname+'/public/'+request.params.glob).pipe(response);
});

app.get('/authorize', function(request, response) {
	var q = encodeURIComponent(string(request.query.q));
	req.post('https://github.com/login/oauth/access_token', {
		headers: {
			'User-Agent': 'node-modules.com'
		},
		form: {
			client_id: param('github.client'),
			client_secret: param('github.secret'),
			code: request.query.code
		}
	}, function(err, res, body) {
		if (err) return response.error(err);
		req('https://api.github.com/user', {
			json:true,
			headers: {
				'User-Agent': 'node-modules.com'
			},
			qs: {
				access_token: qs.parse(body).access_token
			}
		}, function(err, res) {
			if (err) return response.error(err);
			if (request.query.f) return response.redirect('http://'+param('host')+'/?u='+string(res.body.login));
			response.redirect('http://'+param('host')+'/search?q='+q+'&u='+string(res.body.login));
		});
	});
});

app.get('/personalize', function(request, response) {
	if (!param('github.secret')) return response.error(new Error('github secret is not configured'));

	var q = encodeURIComponent(string(request.query.q));
	var f = encodeURIComponent(string(request.query.f));
	var url = 'https://github.com/login/oauth/authorize?'+qs.stringify({
		client_id: param('github.client'),
		redirect_uri:'http://'+param('host')+'/authorize?q='+q+'&f='+f
	});

	response.redirect(url);
});

app.get('/~{username}', function(request, response) {
	response.redirect('/search?q='+encodeURIComponent('@'+request.params.username));
});

app.get('/search', function(request, response) {
	request.search(function(err, modules) {
		if (err) return response.error(err);
		response.render(request.query.partial ? 'partials/modules.html' : 'search.html', {modules:modules});
	});
});

app.get('/favicon.ico', '/public/favicon.ico');

app.get('/', function(request, response) {
	modules.info(function(err, info) {
		if (err) return response.error(err);
		response.render('index.html', info);
	});
});

app.get('/about', function(request, response) {
	response.render('about.html');
});

app.get('/mission', function(request, response) {
	response.render('mission.html');
});

app.get('/{username}/*', function (request, response) {
	request.headers.host = request.params.username + '.node-modules.com';
	request.url = '/' + request.url.slice(request.params.username.length + 1);
	app.route(request, response);
})


app.error(404, function(request, response) {
	response.render('error.html', {
		title:'404 Not Found',
		message:'We cannot find the page you are looking for'
	});
});

app.error(function(request, response, opt) {
	if (opt.error) console.error(opt.error.stack);
	response.render('error.html', {
		title:'Something bad happened',
		message:opt.message || 'Unknown error'
	});
});

app.listen(param('port'), function() {
	console.log('app running on http://'+param('host'));

	if (!param('autoupdate')) return;

	var loop = function() {
		setTimeout(update.bind(null, loop), 3600*1000);
	};

	loop() // update every hour
});
