var EventEmitter = require('events').EventEmitter;
var users = require('./users');
var modules = require('./modules');

var updating;
var update = function() {
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