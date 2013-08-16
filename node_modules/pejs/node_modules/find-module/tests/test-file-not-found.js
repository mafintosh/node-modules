var assert = require('assert');
var findModule = require('../index');
var path = require('path');

findModule('./fixtures/file2', function(err, filename) {
	assert.ok(err);
});
