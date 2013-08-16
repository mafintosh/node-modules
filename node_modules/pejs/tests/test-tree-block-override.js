var assert = require('assert');

require('pejs').tree(__dirname+'/fixtures/block-override.ejs', function(err, tree) {
	if (err) throw err;

	assert.equal(tree[0].type, 'STATIC');
	assert.equal(tree[1].type, 'BLOCK_DECLARE');
	assert.equal(tree[1].body[0].type, 'STATIC');
	assert.equal(tree[1].body.length, 1);
	assert.equal(tree[2].type, 'STATIC');
	assert.equal(tree[3].type, 'BLOCK_OVERRIDE');
	assert.equal(tree[3].body[0].type, 'STATIC');
	assert.equal(tree[3].body.length, 1);
});
