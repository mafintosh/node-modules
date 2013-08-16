var assert = require('assert');
var exec = require('child_process').exec;
var root = require('../index');
var app = root();

var hitIP = false;
var hitLocalhost = false;
var hitPart = false;

var ip = app.fork('127.0.0.1');
var prefix = app.fork('/test');

ip.get(function(req, res) {
	assert.ok(!hitIP);
	assert.equal(req.headers.host, '127.0.0.1:9999');
	hitIP = true;
	res.end();
});
prefix.get(function(req, res) {
	assert.ok(!hitPart);
	assert.equal(req.headers.host, 'localhost:9999');
	assert.equal(req.url, '/');
	hitPart = true;
	res.end();
});

app.get(function(req, res) {
	assert.ok(!hitLocalhost);
	assert.equal(req.headers.host, 'localhost:9999');
	hitLocalhost = true;
	res.end();
});

app.listen(9999, function() {
	exec('curl localhost:9999; curl 127.0.0.1:9999; curl localhost:9999/test', function() {
		assert.ok(hitLocalhost);
		assert.ok(hitIP);
		assert.ok(hitPart);
		process.exit(0);
	});
});