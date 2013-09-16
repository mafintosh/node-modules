var mongojs = require('mongojs');
var db = mongojs('node-modules', ['modules', 'meta', 'users']);

module.exports = db;