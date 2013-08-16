var assert = require('assert');
var exec = require('child_process').exec;
var root = require('../index');
var app = root();

var ran = 0;
var plugin = false;

app.use(function(app, options) {
	assert.ok(!!options);
	plugin = true;
	app.get('/foo', function(req, res) {
		ran++;
		res.end();
	});
	app.use('response.test', function() {
		ran++;
		this.send('ok\n');
	});
}, {});

app.get(function(req, res, next) {
	assert.notEqual(req.url, '/foo');
	ran++;
	res.test();
});

app.listen(9999, function() {
	exec('curl localhost:9999/foo; curl localhost:9999/foobar', function() {
		assert.ok(plugin);
		assert.equal(ran, 3);
		process.exit(0);
	});
});
