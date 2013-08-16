var assert = require('assert');
var pejs = require('pejs');

pejs.render(__dirname+'/fixtures', function(err, result) {
	if (err) throw err;

	assert.equal(result, 'bar');
});
pejs.render(__dirname+'/fixtures/index', function(err, result) {
	if (err) throw err;

	assert.equal(result, 'bar');
});
pejs.render(__dirname+'/fixtures/index.html', function(err, result) {
	if (err) throw err;

	assert.equal(result, 'foo');
});
