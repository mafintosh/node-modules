var assert = require('assert');
var findModule = require('../index');
var path = require('path');

findModule('./fixtures/dir_and_package', function(err, filename) {
	assert.equal(filename, path.join(__dirname, 'fixtures/dir_and_package/hello.js'));
});
