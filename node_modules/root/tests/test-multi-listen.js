var assert = require('assert');
var exec = require('child_process').exec;
var root = require('../index');
var app = root();

var ran = 0;

app.get(function(req, res, next) {
	ran++;
	res.end();
});

app.listen(9999, function() {
	app.listen(10000, function() {
		exec('curl localhost:9999; curl localhost:10000;', function() {
			assert.equal(ran, 2);
			process.exit(0);
		});
	});
});