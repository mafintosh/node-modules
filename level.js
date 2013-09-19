var level = require('level');
var sublevel = require('level-sublevel');

var db = sublevel(level(__dirname+'/db', {valueEncoding:'json', highWaterMark:16}));

var define = function(name) {
	name.split('.').reduce(function(db, sub) {
		return db[sub] = db.sublevel(sub);
	}, db);
};

define('etags');
define('index');
define('index.users');

module.exports = db;
