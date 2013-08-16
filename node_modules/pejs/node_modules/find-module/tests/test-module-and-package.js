var assert = require('assert');
var findModule = require('../index');
var path = require('path');

findModule('dir_and_package', {dirname:'fixtures'}, function(err, filename) {
	assert.equal(filename, path.join(__dirname, 'fixtures/node_modules/dir_and_package/hello.js'));
});
