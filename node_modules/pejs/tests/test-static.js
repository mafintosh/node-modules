var assert = require('assert');

require('pejs').render(__dirname+'/fixtures/static.ejs', function(err, result) {
	if (err) throw err;

	assert.equal(result, 'foo');
});
