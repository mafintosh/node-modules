var assert = require('assert');
var protein = require('../index');

var Proto = function() {};

Proto.prototype.hello = function() {
	return 'hello';
};

var mixin1 = protein().use('request.world1', function() {
	return 'world1';
});

var mixin2 = protein().use('request.world2', function() {
	return 'world2';
});

var request1 = new Proto();

mixin1(request1, {});
mixin2(request1, {});

assert.equal(request1.hello(), 'hello');
assert.equal(request1.world1(), 'world1');
assert.equal(request1.world2(), 'world2');

var request2 = new Proto();

mixin1(request2, {});

assert.equal(request2.world1(), 'world1');
assert.equal(request2.world2, undefined);