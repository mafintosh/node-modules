var assert = require('assert');

require('pejs').render(__dirname+'/fixtures/block-declare.ejs', function(err, result) {
	if (err) throw err;

	assert.equal(result.replace(/\s+/g, ' ').trim(), 'foo bar');
});
