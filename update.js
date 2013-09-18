var EventEmitter = require('events').EventEmitter;
var users = require('./users');
var modules = require('./modules');

var updating;
var update = function(callback) {
	if (callback) return update().on('end', callback);
	if (updating) return updating;

	updating = new EventEmitter();
	updating.setMaxListeners(0);
	updating.on('end', function() {
		updating = null;
	});

	var emit = function(name) {
		return function(data) {
			updating.emit(name, data);
		};
	};

	modules.update()
		.on('module', emit('module'))
		.on('end', function(err) {
			if (err) return updating.emit('end', err);
			users.update()
				.on('user', emit('user'))
				.on('end', emit('end'));
		});

	return updating;
};

module.exports = update;

if (require.main !== module) return;

var log = require('single-line-log');

update()
	.on('module', function(mod) {
		log('updating module '+mod._id+' (v'+mod.version+')');
	})
	.on('user', function(user) {
		log('updating user '+user._id+' ('+user.updates+' updates)');
	})
	.on('end', function() {
		process.exit(0);
	})