var assert = require('assert');
var protein = require('../index');

var world = function() {};

var mixin = protein().use('response.world', world);
var response = {};

mixin({}, response);

assert.equal(response.world, world);
assert.equal(response.__proto__.world, world);