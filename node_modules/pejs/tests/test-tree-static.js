var assert = require('assert');

require('pejs').tree(__dirname+'/fixtures/static.ejs', function(err, tree) {
	if (err) throw err;

	assert.equal(tree[0].type, 'STATIC');
	assert.equal(tree[0].value, 'foo');
});
