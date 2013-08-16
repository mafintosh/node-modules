var assert = require('assert');
var protein = require('../index');

var world = function() {};

var mixin = protein().use('request.world', world);
var request = {};

mixin(request, {});

request.world = 24;

assert.equal(request.world, 24);

delete request.world;

assert.equal(request.world, world);