var assert = require('assert');
var exec = require('child_process').exec;
var root = require('../index');
var app = root();

var ran = 0;

app.all(function(req, res, next) {
	assert.ok(true);
	ran++;
	next();
});
app.get(function(req, res, next) {
	assert.ok(true);
	ran++;
	next();
});
app.get(function(req, res) {
	assert.ok(true);
	ran++;
	res.end();
});
app.get(function(req, res) {
	assert.ok(false);
});

app.listen(9999, function() {
	exec('curl localhost:9999', function() {
		assert.equal(ran, 3);
		process.exit(0);
	});
});