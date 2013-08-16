var assert = require('assert');
var murl = require('../index');

var test = function(pattern, url) {
	if (!murl(pattern)(url)) throw new Error(pattern+' can not match '+url);
};

test('/{first}/{value}?', '/hello world');
test('/{first}?/{value}', '/hello world');
test('/{first}-{value}', '/200-200');
test('/{first}?-{value}?', '/200-200');
test('/{first}?-{value}?', '/-200');
test('/{first}?-{value}?', '/-');
test('/{first}?-{value}?', '/200-');
test('/.{value}', '/.foobar');
test('/.{value}?', '/');
test('/.{value}?/second', '/second');
test('/{*}', '/hello/world/again');
test('/*', '/');
test('/*', '/hello/world/again');
test('*', '/hello/world/again');
test('/hello/*', '/hello/world/again');
test('/hello/{double}(.+\\/.+)/world', '/hello/abefest/sjov/world');
test('/hello.{world}?', '/hello');
test('/hello.{world}?', '/hello.hello');