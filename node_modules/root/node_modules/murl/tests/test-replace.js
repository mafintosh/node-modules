var assert = require('assert');
var murl = require('../index');

var test = function(pattern, opt, eq) {
	assert.equal(murl(pattern)(opt), eq);
};

test(undefined, {}, '');
test(undefined, {test:42}, '');

test('/hello', {}, '/hello');
test('/{hello}', {hello:'hello'}, '/hello');
test('/{hello}', {hello:'hello world'}, '/hello world');
test('/{*}', {'*':'hello world'}, '/hello world');
test('/*', {'*':'hello world'}, '/hello world');
test('/*', {'*':'hello world/more'}, '/hello world/more');
test('/{hello}/{world}', {hello:'hello',world:'world'}, '/hello/world');
test('/{hello}/{world}', {unused:true, hello:'hello',world:'world'}, '/hello/world');
