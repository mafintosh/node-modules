var root = require('root');
var LRU = require('lru-cache');
var modules = require('./modules');
var user = require('./user');

var app = root();

var cache = LRU(30000);
var anon = user();

app.on('route', function(request, response) {
	var username = request.query.u;

	if (!username) {
		request.user = anon;
		return;
	}

	if (!cache.has(username)) cache.set(username, user(username));
	request.user = cache.get(username);
});

var string = function(str) {
	return str && str+'';
};

app.use('request.search', function(callback) {
	var query = string(this.query.q);
	var marker = string(this.query.marker);
	var limit = Math.min(parseInt(this.query.limit, 10) || 20, 50);

	this.user.search(query, {marker:marker, limit:limit}, callback);
});

app.get('/package/{name}.json', function(request, response) {
	modules.get(request.params.name, function(err, module) {
		if (err) return response.error(err);
		response.send(module);
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
		response.send(info);
	});
});

app.listen(10000);