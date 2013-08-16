var clone = function(from, to) {
	if (!from) return;

	to = to || {};
	Object.keys(from).forEach(function(key) {
		var getter = from.__lookupGetter__(key);
		var setter = from.__lookupSetter__(key);

		if (getter) return to.__defineGetter__(key, getter);
		if (setter) return to.__defineSetter__(key, setter);

		to[key] = from[key];
	});
	return to;
};
var injector = function() {
	var hash = [];
	var protos = [];
	var empty;
	var inject = function(obj) {
		if (empty === undefined) {
			empty = !Object.keys(inject.proto).length;
		}
		if (empty) return;

		var i = hash.indexOf(obj.__proto__);

		if (i === -1) {
			i = protos.indexOf(obj.__proto__);
		}
		if (i === -1) {
			protos[protos.push(clone(inject.proto))-1].__proto__ = obj.__proto__;
			i = hash.push(obj.__proto__)-1;
		}
		obj.__proto__ = protos[i];
	};

	inject.proto = {};
	return inject;
};

module.exports = function() {
	var onresponse = injector();
	var onrequest = injector();
	var mixin = function(request, response, next) {
		request.response = response;
		onrequest(request);
		response.request = request;
		onresponse(response);
		if (!next) return;
		response.next = request.next = next;
		next();
	};

	mixin.request = onrequest.proto;
	mixin.response = onresponse.proto;
	mixin.use = function(key, options, fn) {
		if (typeof options === 'function') return mixin.use(key, {}, options);

		key = key.replace('res.', 'response.').replace('req.', 'request.').split('.');
		var owner = key[0] === 'response' ? onresponse : onrequest;
		var method = key[1];

		if (options.getter) {
			owner.proto.__defineGetter__(method, fn);
		} else if (options.setter) {
			owner.proto.__defineSetter__(method, fn);
		} else {
			owner.proto[method] = fn;
		}
		return mixin;
	};
	return mixin;
};