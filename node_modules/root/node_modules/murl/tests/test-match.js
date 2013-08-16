var assert = require('assert');
var murl = require('../index');

assert.ok(murl('/hello')('/hello'));
assert.ok(murl()('/hello'));
assert.ok(murl()('/hello/world'));

assert.equal(murl('/{hello}')('/hello').hello, 'hello');
assert.equal(murl('/{hello}')('/hello world').hello, 'hello world');
assert.equal(murl('/{*}')('/hello/world').glob, 'hello/world');
assert.equal(murl('/{*}')('/hello/world world').glob, 'hello/world world');