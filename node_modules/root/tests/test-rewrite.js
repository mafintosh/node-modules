var assert = require('assert');
var exec = require('child_process').exec;
var root = require('../index');
var app = root();

var ran = 0;

app.get('/', '/foo');
app.get('/foo', function(req, res) {
	assert.equal(req.url, '/foo');
	ran++;
	res.end();
});
app.get('/bar', '/baz', function(req, res) {
	assert.equal(req.url, '/baz');
	ran++;
	res.end();
});
app.get('/a/{data}', '/b/{data}', function(req, res) {
	assert.equal(req.url, '/b/foobar');
	ran++;
	res.end();
});

app.listen(9999, function() {
	exec('curl localhost:9999/; curl localhost:9999/bar; curl localhost:9999/a/foobar', function() {
		assert.equal(ran, 3);
		process.exit(0);
	});
});
