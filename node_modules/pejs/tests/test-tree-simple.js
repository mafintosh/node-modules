var assert = require('assert');

require('pejs').tree(__dirname+'/fixtures/simple.ejs', function(err, tree) {
	if (err) throw err;

	assert.equal(tree[0].type, 'STATIC');
	assert.equal(tree[0].value.trim(), 'foo');
	assert.equal(tree[1].type, 'EXPRESSION');
	assert.equal(tree[1].value.trim(), 'bar');
	assert.equal(tree[2].type, 'STATIC');
	assert.equal(tree[2].value.trim(), 'baz');
});
