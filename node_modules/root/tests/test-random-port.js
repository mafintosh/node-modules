var assert = require('assert');
var exec = require('child_process').exec;
var root = require('../index');
var app = root();

var ran = 0;
app.get(function(req, res) {
	ran++;
	res.end();
});
app.listen(function(addr) {
	exec('curl '+addr, function() {
		assert.equal(ran, 1);
		process.exit(0);
	});
});