var assert = require('assert');
var protein = require('../index');

var hello = function() {};

var mixin = protein().use('request.hello', hello);
var request = {};

mixin(request, {});

assert.equal(request.hello, hello);
assert.equal(request.__proto__.hello, hello);