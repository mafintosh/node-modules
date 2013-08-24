# stream-wrapper

Drop-in replacement for the core [stream](http://nodejs.org/api/stream.html) module
that allows you to wrap `read`/`write`/`transform` functions into streams.

	npm install stream-wrapper

All streams create are stream2 streams

## Readable Stream

``` js
var stream = require('stream-wrapper');

var rs = stream.readable(function(size) {
	this.push(new Buffer('hello world'));
});
```

If you don't have a `read` function just omit it

``` js
var rs = stream.readable();
rs.push(new Buffer('hello world'));
```

The Readable prototype is exposed through `stream.Readable`.

## Writable Stream

``` js
var stream = require('stream-wrapper');

var ws = stream.writable(function(chunk, enc, callback) {
	console.log('writing', chunk);
	callback();
});
```

The Writable prototype is exposed through `stream.Writable`.

## Duplex Stream

``` js
var stream = require('stream-wrapper');

var ds = stream.duplex(function() {
	// read function
	this.push(new Buffer('hello world'));
}, function write(chunk, enc, callback) {
	// write function
	console.log('writing', chunk);
	callback();
});
```

The Duplex prototype is exposed through `stream.Duplex`

## Transform Stream

``` js
var stream = require('stream-wrapper');

var ts = stream.transform(function(chunk, enc, callback) {
	this.push(chunk);
	callback();
});
```

If you want to add a flush function pass it as the second parameter

``` js
var ts = stream.transform(function(chunk, enc, callback) {
	// transform function
	this.push(chunk);
	callback();
}, function(callback) {
	// flush function
	console.log('now flushing...');
	callback();
});
```

The Transform prototype is exposed through `stream.Transform`

## Stream options

If you want to pass stream options (like `objectMode`) pass them as the first
parameter to `readable`, `writable`, `duplex` or `transform`

``` js
var rs = stream.readable({objectMode:true}, function() {
	this.push({message:'i am an object'});
});
```

## Stream defaults

You can change the default options for the stream by calling `defaults`

``` js
// all streams created have objectMode enabled
stream = stream.defaults({objectMode:true});
```

## Stream.destroy

All streams have a `.destroy` method implemented per default that when called
emits `close` and sets `stream.destroyed = true`.

``` js
var rs = stream.readable();

rs.on('close', function() {
	// rs.destroyed === true
	console.log('someone called destroy');
});

rs.destroy();
```

# License

MIT