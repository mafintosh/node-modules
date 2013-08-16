var assert = require('assert');
var exec = require('child_process').exec;
var root = require('../index');
var app1 = root();
var app2 = root();

var ran = 0;

app1.get(function(req, res, next) {
	ran++;
	if (!req.query.foo) return next();
	app2.route(req, res, next);
});
app1.get('/', function(req, res) {
	ran++;
	assert.ok(!req.query.foo);
	res.end();
});
app2.get('/', function(req, res, next) {
	ran++;
	assert.ok(req.query.foo);
	res.end();
});

app1.listen(9999, function() {
	exec('curl localhost:9999/; curl localhost:9999/?foo=bar', function() {
		assert.equal(ran, 4);
		process.exit(0);
	});
});