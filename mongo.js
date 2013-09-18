var mongojs = require('mongojs');
var param = require('param');
var db = mongojs(param('mongo'), ['modules', 'meta', 'users']);

module.exports = db;