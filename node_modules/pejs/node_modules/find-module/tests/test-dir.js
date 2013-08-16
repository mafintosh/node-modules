var assert = require('assert');
var findModule = require('../index');
var path = require('path');

findModule('./fixtures/dir', function(err, filename) {
	assert.equal(filename, path.join(__dirname, 'fixtures/dir/index.js'));
});
