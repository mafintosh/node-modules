var stream = require('./index').defaults({objectMode:true});
var i = 0;

stream.readable(function() {
	this.push({count:i++});
})
.pipe(stream.transform(function(data, enc, callback) {
	this.push(data);
	setTimeout(callback, 1000);
}))
.pipe(stream.transform(function(data, enc, callback) {
	if (data.count % 2) return callback();
	this.push(data);
	callback();
}))
.pipe(stream.transform(function(data, enc, callback) {
	this.push(JSON.stringify(data)+'\n');
	callback();
}))
.pipe(process.stdout)