var assert = require('assert');

require('pejs').render(__dirname+'/fixtures/multiline.ejs', function(err, result) {
	if (err) throw err;

	assert.equal(result.replace(/\s+/g, ' ').trim(), 'first line foo 1 baz foo 2 baz foo 3 baz');
});
