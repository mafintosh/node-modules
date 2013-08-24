var stream = require('stream');
var extend = require('xtend');
var util = require('util');

var streamable = function(Proto) {
	var Stream = function(options) {
		if (options && options.objectMode && !options.highWaterMark) options.highWaterMark = 16;
		Proto.call(this, options);
		this.destroyed = false;
	};

	util.inherits(Stream, Proto);

	Stream.prototype.destroy = function() {
		if (this.destroyed) return;
		this.destroyed = true;
		this.emit('close');
	};

	return Stream;
};

var Readable = streamable(stream.Readable || require('readable-stream/readable'));
var Writable = streamable(stream.Writable || require('readable-stream/writable'));
var Transform = streamable(stream.Transform || require('readable-stream/transform'));
var Duplex = streamable(stream.Duplex || require('readable-stream/duplex'));
var PassThrough = streamable(stream.PassThrough || require('readable-stream/passthrough'));

var noop = function() {};

var defaults = function(def) {
	def = def || {};

	var that = {};

	that.Readable = Readable;
	that.Writable = Writable;
	that.Transform = Transform;
	that.Duplex = Duplex;
	that.PassThrough = PassThrough;

	var mixin = function(opt) {
		return extend(def, opt);
	};

	that.readable = function(opt, read) {
		if (typeof opt === 'function') return that.readable(null, opt);
		var readable = new Readable(mixin(opt));
		readable._read = read || noop;
		return readable;
	};

	that.writable = function(opt, write) {
		if (typeof opt === 'function') return that.writable(null, opt);
		var writable = new Writable(mixin(opt));
		writable._write = write || noop;
		return writable;
	};

	that.duplex = function(opt, read, write) {
		if (typeof opt === 'function') return that.duplex(null, opt, read);
		var duplex = new Duplex(mixin(opt));
		duplex._read = read || noop;
		duplex._write = write || noop;
		return duplex;
	};

	that.transform = function(opt, transform, flush) {
		if (typeof opt === 'function') return that.transform(null, opt, transform);
		var trans = new Transform(mixin(opt));
		trans._transform = transform || noop;
		if (flush) trans._flush = flush;
		return trans;
	};

	that.passThrough = function(opt) {
		return new PassThrough(mixin(opt));
	};

	that.defaults = defaults;

	return that;
};

module.exports = defaults();