var assert = require('assert');
var findModule = require('../index');
var path = require('path');

findModule('something', function(err, filename) {
	assert.ok(err);
});
