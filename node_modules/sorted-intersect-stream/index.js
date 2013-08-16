var util = require('util');
var Readable = require('stream').Readable;

var defaultKey = function(val) {
	return val;
};

var stream2 = function(stream) {
	if (stream._readableState) return stream;
	return new Readable({objectMode:true}).wrap(stream);
};

var destroy = function(stream) {
	if (stream.readable && stream.destroy) stream.destroy();
};

var reader = function(self, stream, toKey) {
	stream = stream2(stream);

	var onmatch;
	var target;
	var ended = false;

	var consume = function() {
		var data;
		while (onmatch && (data = stream.read())) {
			var key = toKey(data);
			if (target !== undefined && key < target) continue;
			var tmp = onmatch;
			onmatch = undefined;
			tmp(data, key);
		}
	};

	var onend = function() {
		if (ended) return;
		ended = true;
		if (onmatch) self.destroy();
	};

	stream.on('error', function(err) {
		self.emit('error', err);
		self.destroy();
	});

	stream.on('close', function() {
		if (stream._readableState.ended) return;
		onend();
	});

	stream.on('end', onend);

	stream.on('readable', consume);

	return function(key, fn) {
		if (ended) return self.destroy();
		onmatch = fn;
		target = key;
		consume();
	};
};

var Intersect = function(a, b, toKey) {
	if (!(this instanceof Intersect)) return new Intersect(a, b, toKey);
	Readable.call(this, {objectMode:true});

	toKey = typeof toKey === 'function' ? toKey : defaultKey;

	this._readA = reader(this, a, toKey);
	this._readB = reader(this, b, toKey);
	this._destroyed = false;

	this.on('end', function() {
		if (!this.autoDestroy) return;
		destroy(a);
		destroy(b);
	});
};

util.inherits(Intersect, Readable);

Intersect.prototype.autoDestroy = true;

Intersect.prototype.destroy = function() {
	if (this._destroyed) return;
	this._destroyed = true;
	this.push(null);
};

Intersect.prototype._read = function() {
	this._loop(undefined);
};

Intersect.prototype._loop = function(last) {
	var self = this;
	self._readA(last, function(match, matchKey) {
		if (matchKey === last && !self._destroyed) return self.push(match);
		self._readB(matchKey, function(other, otherKey) {
			if (otherKey === matchKey && !self._destroyed) return self.push(other);
			self._loop(otherKey);
		});
	});
};

module.exports = Intersect;