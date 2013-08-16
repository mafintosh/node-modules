var assert = require('assert');
var exec = require('child_process').exec;
var root = require('../index');
var app = root();

var ran = 0;

app.get('/401', function(req, res, next) {
	next(401);
});
app.get('/400', function(req, res) {
	res.error(400);
});
app.get('/500', function(req, res, next) {
	next(new Error('lol'));
});

app.error('4xx', function(req, res) {
	assert.ok(/4\d\d/.test(req.url));
	ran++;
	res.end();
});
app.error(404, function(req, res) {
	assert.equal(req.url, '/404');
	ran++;
	res.end();
});
app.error(function(req, res, options) {
	assert.ok(options.error);
	assert.ok(options.stack);
	assert.equal(res.statusCode, 500);
	ran++;
	res.end();
});

app.listen(9999, function() {
	exec('curl localhost:9999/404; curl localhost:9999/400; curl localhost:9999/401', function() {
		assert.equal(ran, 3);
		process.exit(0);
	});
});