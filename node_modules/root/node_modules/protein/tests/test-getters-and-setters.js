var assert = require('assert');
var protein = require('../index');

var b;
var a = 'a';

var mixin = protein()
	.use('respont.a', {getter:true}, function() {
		return a;
	})
	.use('request.b', {setter:true}, function(value) {
		b = value;
	})

var request = {};

mixin(request, {});

assert.equal(request.a, a);

request.b = 'a value';

assert.equal(b, 'a value');