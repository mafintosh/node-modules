var level = require('level');
var sublevel = require('level-sublevel');

var db = sublevel(level(__dirname+'/db', {valueEncoding:'json'}));

var sub = function(db, name) {
	db[name] = db.sublevel(name);
};

sub(db, 'index');
sub(db, 'etags');
sub(db, 'modules');
sub(db, 'updates');
sub(db, 'meta');
sub(db, 'users');

module.exports = db;
