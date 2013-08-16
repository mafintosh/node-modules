var assert = require('assert');
var murl = require('../index');

var test = function(pattern, url) {
	if (murl(pattern)(url)) throw new Error(pattern+' should not match '+url);
};

test('/{first}', '/hello/world');
test('/{first}([0-9]+)', '/42hello');