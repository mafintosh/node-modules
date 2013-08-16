var assert = require('assert');
var root = require('../index');
var app = root();

var noop = function() {};

app.get('/', noop);
app.get('/foo', noop);
app.get('/bar/{baz}', noop);
app.post('/lol');

assert.ok(app.matches({method:'GET', url:'/'}));
assert.ok(app.matches({method:'GET', url:'/foo'}));
assert.ok(app.matches({method:'GET', url:'/foo?bar'}));
assert.ok(app.matches({method:'GET', url:'/bar/lol'}));
assert.ok(app.matches({method:'POST', url:'/lol'}));

assert.ok(!app.matches({method:'GET', url:'/meh'}));
assert.ok(!app.matches({method:'POST', url:'/foo'}));