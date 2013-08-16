var assert = require('assert');
var exec = require('child_process').exec;
var root = require('../index');
var cluster = require('cluster');

if (cluster.isMaster) {
	cluster.fork().on('exit', function() {
		process.exit(0);
	});
	return;
}

root().listen(function(addr1) {
	root().listen(function(addr2) {
		assert.notEqual(addr1, addr2);
		process.exit(0);
	});
});
