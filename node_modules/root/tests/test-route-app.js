var assert = require('assert');
var exec = require('child_process').exec;
var root = require('../index');
var app1 = root();
var app2 = root();

var ran = 0;

app2.get(function(req, res, next) {
	ran++;
	req.foobar = true;
	next();
});

app1.get(app2);
app1.get(function(req, res) {
	ran++;
	assert.ok(req.foobar);
	res.end();
});

app1.listen(9999, function() {
	exec('curl localhost:9999;', function() {
		assert.equal(ran, 2);
		process.exit(0);
	});
});