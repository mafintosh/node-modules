var level = require('level');
var sublevel = require('level-sublevel');

var db = sublevel(level(__dirname+'/db', {valueEncoding:'json'}));

var define = function(name) {
	name.split('.').reduce(function(db, sub) {
		return db[sub] = db.sublevel(sub);
	}, db);
};

define('etags');
define('index');
define('users');

define('modules');
define('modules.cached');
define('modules.meta');

module.exports = db;
