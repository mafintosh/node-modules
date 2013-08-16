var assert = require('assert');
var protein = require('../index');

var mixin = protein();
var request = {};
var complete = false;

assert.equal(mixin.length, 3);

mixin(request, {}, function(err) {
	complete = true;
	assert.ok(!err);
});

assert.ok(complete);
