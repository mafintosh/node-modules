var assert = require('assert');
var findModule = require('../index');
var path = require('path');

findModule('file', {modules:'fixtures'}, function(err, filename) {
	assert.equal(filename, path.join(__dirname, 'fixtures/file.js'));
});
