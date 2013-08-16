var assert = require('assert');
var exec = require('child_process').exec;
var root = require('../index');
var app = root();

var ran = 0;

app.post('/body', function(req, res) {
	req.on('body', function(body) {
		ran++;
		assert.equal(body, 'body');
		res.end();
	});
});
app.post('/json', function(req, res, next) {
	req.on('json', function(body) {
		ran++;
		assert.equal(body.foo, 'bar');
		res.end();
	});
});
app.post('/form', function(req, res, next) {
	req.on('form', function(body) {
		ran++;
		assert.equal(body.bar, 'baz');
		res.end();
	});
});

app.listen(9999, function() {
	exec('curl -d body localhost:9999/body; curl -d \'{"foo":"bar"}\' localhost:9999/json; curl -d "bar=baz" localhost:9999/form', function() {
		assert.equal(ran, 3);
		process.exit(0);
	});
});