var assert = require('assert');
var exec = require('child_process').exec;
var root = require('../index');
var app = root();

var ran = 0;
var index = false;

app.get('/', function(req, res) {
	index = true;
	ran++;
	assert.equal(req.url, '/b/../../../../../?abe=test');
});
app.get('/a', function(req, res) {
	ran++;
	assert.equal(req.url, '/a/b/..');
});
app.get('/b/{a}/{b}', function(req, res) {
	ran++;
	assert.equal(req.params.a, 'a');
	assert.equal(req.params.b, 'b');
});
app.get('/c/*', function(req, res) {
	ran++;
	assert.equal(req.params.glob, 'abe fest er/sjov');
});

var test = function(url) {
	var req = new process.EventEmitter();
	var res = new process.EventEmitter();

	req.method = 'GET';
	req.url = url;
	app.route(req, res);
};

test('/a/b/..');
test('/b/../../../../../?abe=test');
test('/b/a%2fb');
test('/c/abe%20fest%20er/meh/../sjov');

assert.ok(index);
assert.equal(ran, 4);
