var assert = require('assert');

require('pejs').tree(__dirname+'/fixtures/multiline.ejs', function(err, tree) {
	if (err) throw err;

	assert.equal(tree[0].type, 'STATIC');
	assert.equal(tree[1].type, 'LOGIC');
	assert.equal(tree[2].type, 'STATIC');
	assert.equal(tree[3].type, 'EXPRESSION');
	assert.equal(tree[4].type, 'STATIC');
	assert.equal(tree[5].type, 'LOGIC');
});
