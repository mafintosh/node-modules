var assert = require('assert');
var exec = require('child_process').exec;
var root = require('../index');
var app = root();

var ran = 0;

app.get('/', function(req, res) {
	assert.equal(req.method, 'GET');
	assert.equal(req.url, '/');
	ran++;
	res.end();
});
app.get('/foo', function(req, res) {
	assert.equal(req.method, 'GET');
	assert.equal(req.url, '/foo');
	ran++;
	res.end();
});
app.get('/{foo}', function(req, res) {
	assert.equal(req.method, 'GET');
	assert.equal(req.params.foo, 'foobar');
	ran++;
	res.end();
});
app.get(function(req, res) {
	assert.equal(req.method, 'GET');
	assert.equal(req.url, '/foo/bar');
	ran++;
	res.end();
});

app.post('/foo', function(req, res) {
	assert.equal(req.method, 'POST');
	assert.equal(req.url, '/foo')
	ran++;
	res.end();
});

app.listen(9999, function() {
	exec('curl localhost:9999; curl localhost:9999/foo; curl localhost:9999/foobar; curl localhost:9999/foo/bar; curl -X POST localhost:9999/foo', function() {
		assert.equal(ran, 5);
		process.exit(0);
	});
});
