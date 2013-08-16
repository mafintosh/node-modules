var assert = require('assert');
var protein = require('../index');

var Proto = function() {};

Proto.prototype.hello = function() {
	return 'hello';
};

var mixin = protein().use('request.world', function() {
	return 'world';
});

var request = new Proto();

mixin(request, {});

assert.equal(request.hello(), 'hello');
assert.equal(request.world(), 'world');
assert.equal(Proto.prototype.world, undefined);