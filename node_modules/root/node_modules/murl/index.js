var rewrite = function(pattern, visit) {
	var captures = [];

	pattern = pattern.replace(/\*([^}]|$)/g, '{*}$1');
	pattern = pattern.replace(/(\/)?(\.)?\{([^{]+)\}(?:\(([^)]+)\))?(\?)?(?=(.|$))/g, function(_, slash, dot, name, capture, optional, closed) {
		if (!/^(\w|\d|[_\-.*])+$/g.test(name)) throw new Error('bad pattern name: '+name);
		captures.push(visit({
			slash:slash ? '\\/' : '',
			dot:dot ? '\\.' : '',
			name:name,
			capture:capture,
			optional:optional,
			closed:closed === '' || closed === '/'
		}));
		return '@';
	});

	return pattern.replace(/([\\\/."])/g, '\\$1').replace(/@/g, function() {
		return captures.shift();
	});
};
var replacer = function(pattern) {
	if (!pattern) {
		return function() {
			return '';
		};
	}

	pattern = 'return "'+rewrite(pattern, function(params) {
		return params.slash+params.dot+'"+params["'+params.name+'"]+"';
	})+'";';

	return new Function('params',pattern.replace(/\+"";$/, ';'));
};
var matcher = function(pattern) {
	if (!pattern) {
		return function() {
			return {};
		};
	}

	var names = [];
	pattern = rewrite(pattern, function(params) {
		names.push(params.name);
		params.capture  = params.capture  || (params.name === '*' ? '.+?' : '[^\\/]+');
		params.optional = params.optional || (params.name === '*' ? '?' : '');
		return (params.closed ? '(?:'+params.slash+params.dot : params.slash+'(?:'+params.dot)+'('+params.capture+'))'+params.optional;
	});

	var src = 'var pattern=/^'+pattern+'[\\/]?$/i;\nvar match=str.match(pattern);\nreturn match && {';
	for (var i = 0; i < names.length; i++) {
		if (names[i] === '*') {
			src += '"*":match['+(i+1)+'] || "","glob":match['+(i+1)+'] || ""';
		} else {
			src += '"'+names[i]+'":match['+(i+1)+']';
		}
		src += (i+1 < names.length ? ',' : '');
	}
	src += '};';

	return new Function('str', src);
};

module.exports = function(pattern) {
	var match = matcher(pattern);
	var replace = replacer(pattern);

	return function(url) {
		return (typeof url === 'string' ? match : replace)(url);
	};
};