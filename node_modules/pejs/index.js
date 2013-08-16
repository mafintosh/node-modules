var fs = require('fs');
var vm = require('vm');
var path = require('path');
var findModule = require('find-module');

var STATIC            = 'STATIC';
var LOGIC             = 'LOGIC';
var EXPRESSION        = 'EXPRESSION';
var ESCAPE_EXPRESSION = 'ESCAPE_EXPRESSION';
var BLOCK_DECLARE     = 'BLOCK_DECLARE';
var BLOCK_OVERRIDE    = 'BLOCK_OVERRIDE';
var BLOCK_ANONYMOUS   = 'BLOCK_ANONYMOUS';

var TOKEN_BEGIN = '<%';
var TOKEN_END   = '%>';
var GLOBAL_FNS = 'function _esc_(s){return (s+"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}\n'+
	'function _inline_(fn){var s=fn();return function(){return s;};}\n';

var MATCH_BLOCK = /^(\w+)?\s*((?:'(?:(?:\\')|[^'])*')|(?:"(?:(?:\\")|[^"])*"))?(?:\s+(.+))?$/;

var ROOT = path.resolve('/'); // find out what / is in windows terms

var noop = function() {};
var compress = function(str) {
	return exports.compress ? str.replace(/\s+/g, ' ') : str;
};

// parse pejs source into a source tree
var parse = function(src) {
	return Array.prototype.concat.apply([], src.split(TOKEN_END).map(function(slice) {
		return slice.split(TOKEN_BEGIN);
	})).map(function(data, i) {
		if (i % 2 === 0) return data && {type:STATIC, value:data};

		var pre = (data.match(/^(\S*)/g) || [])[0];
		var end = (data.match(/(\S*)$/g) || [])[0];
		var line = data.replace(/^\S*/g, '').replace(/\S*$/g, '').trim();
		var live = pre[1] === '[';
		var auto = pre === '{{' ? BLOCK_DECLARE : BLOCK_OVERRIDE;
		var ctx = (pre+end).replace(/[\{\[]+/g, '{').replace(/[\}\]]+/g, '}');

		if (pre === '')  return {type:LOGIC, value:line};
		if (pre === '#') return null;
		if (pre === '=') return {type:ESCAPE_EXPRESSION, value:line};
		if (pre === '-') return {type:EXPRESSION, value:line};

		line = (line.match(MATCH_BLOCK) || []).slice(1);
		line = !line.length || (line[2] && !line[2]) ? {} : {
			name:line[0],
			url:line[1] && line[1].substr(1, line[1].length-2).replace(/\\(.)/g, '$1'),
			locals:line[2] && line[2].trim()
		};

		if (ctx === '{}' && line.name) return {type:auto, live:live, name:line.name, locals:line.locals, url:line.url, body:[]};
		if (ctx === '{}' && line.url)  return {type:BLOCK_ANONYMOUS, url:line.url, locals:line.locals};
		if (ctx === '{' && line.name)  return {type:auto, live:live, name:line.name, locals:line.locals, capture:1, body:[]};
		if (ctx === '}')               return {capture:-1};

		throw new SyntaxError('could not parse: <%'+data+'%>');
	}).reduce(function reduce(result, node) {
		var last = result[result.length-1];

		if (!node) return result;
		if (!last || !last.capture) return result.concat(node);

		last.capture += node.capture || 0;
		last.body = last.capture ? last.body.concat(node) : last.body.reduce(reduce, []);
		return result;
	}, []);
};

// compile a source tree down to javascript
var compile = function(tree, name) {
	var global = [GLOBAL_FNS];
	var cnt = 0;

	var wrap = function(vars, body) {
		return vars ? 'with(locals){var _r=[];var _b={};\n'+body+'}\n' : 'with(locals){\n'+body+'}\n';
	};

	var debugable = function(url) {
		return '_'+(url || '').split('/').slice(-2).join('_').replace(/[^a-zA-Z]/g, '_')+'_'+(cnt++);
	};

	var stringify = function(tree) {
		var src = '';
		var pushBefore = false;

		var push = function(value) {
			if (pushBefore) return src = src.slice(0,-3)+'+'+value+');\n';
			src += '_r.push('+value+');\n';
			pushBefore = true;
		};

		var logic = function(value) {
			pushBefore = false;
			src += value+'\n';
		};

		tree.forEach(function(node) {
			if (node.type === STATIC)            return push(JSON.stringify(compress(node.value)));
			if (node.type === EXPRESSION)        return push('('+node.value+')');
			if (node.type === ESCAPE_EXPRESSION) return push('_esc_('+node.value+')');
			if (node.type === LOGIC)             return logic(node.value);

			var locals = node.locals || 'locals';
			var name = node.name && JSON.stringify(node.name);
			var decl = node.name && JSON.stringify(node.name+'$decl');
			var id = debugable(node.url);

			if (node.type === BLOCK_ANONYMOUS) {
				global.push('function '+id+'(_r,_b,locals){'+wrap(false, stringify(node.body))+'}\n');
				return logic(id+'(_r,_b,'+locals+');');
			}

			if (node.type === BLOCK_DECLARE) {
				logic('if (_b['+decl+']) _b['+decl+'].toString=_inline_(_b['+decl+'].toString);');
				logic('_r.push(_b['+decl+']={toString:function(){return _b['+name+']();}});');
			}

			global.push('function '+id+'(locals){'+wrap(true, stringify(node.body)+'return _r;')+'}\n');
			logic('_b['+name+']=function(){return '+id+'('+locals+').join("");};');
		});

		return src;
	};

	var main = debugable(name);
	var src = stringify(tree);
	return global.join('')+'module.exports=function '+main+'(locals){locals=locals||{};'+wrap(true,src)+'return _r.join("");};';
};

// create a 'not-found' error
var enoent = function(message) {
	var err = new Error(message);
	err.code = 'ENOENT';
	return err;
};

var free = true;
var waiting = [];

// "locks" the execution - let everyone else wait for something to finish
var lock = function(callback, fn) { // TODO: move to module
	if (!free) return waiting.push(arguments);

	free = false;
	fn(function() {
		free = true;
		callback.apply(null, arguments);
		if (waiting.length) lock.apply(null, waiting.shift());
	});
};

var watchers = {};

var watchFiles = function(filenames, fn) { // TODO: find or create a module that does caching/watching for us
	var onchange = function() {
		filenames.forEach(function(filename) {
			if (!watchers[filename]) return;
			watchers[filename].removeListener('change', onchange);
		});

		fn();
	};

	filenames.forEach(function watchFile(filename) {
		if (watchers[filename]) return watchers[filename].once('change', onchange);

		watchers[filename] = fs.watch(filename, {persistent:false}, noop);
		watchers[filename].setMaxListeners(0);
		watchers[filename].once('change', function() {
			delete watchers[filename];
			this.close();
		});

		watchFile(filename, fn);
	});
};

var cache = exports.cache = {};

exports.tree = function(name, callback) {
	var files = [];

	var onsource = function(filename, source, callback) {
		var dirname = path.dirname(filename);
		var tree = parse(source);

		files.push(filename);

		var nodes = [];
		var visit = function(node) {
			if (node.url) nodes.push(node);
			if (node.body) node.body.forEach(visit);
		};

		tree.forEach(visit);

		if (!nodes.length) return callback(null, tree, filename);

		var i = 0;
		var loop = function() {
			var node = nodes[i++];

			if (!node) return callback(null, tree, filename);

			resolve(node.url, dirname, function(err, resolved, url) {
				if (err) return callback(err);

				node.url = url;
				node.body = resolved;
				loop();
			});
		};

		loop();
	};

	var resolve = function(name, dirname, callback) {
		findModule(name, {
			dirname: dirname,
			extensions: ['pejs', 'ejs', 'html'],
			modules: 'views'
		}, function(err, filename) {
			if (err) return callback(err);

			fs.readFile(filename, 'utf-8', function(err, source) {
				if (err) return callback(err);

				onsource(filename, source, callback);
			});
		});
	};

	lock(callback, function(free) {
		if (cache[name]) return free(null, cache[name].tree, cache[name].url);

		resolve(name, process.cwd(), function(err, tree, url) {
			if (err) return free(err);

			cache[name] = cache[name] || {};
			cache[name].tree = tree;
			cache[name].url = url;

			watchFiles(files, function() {
				delete cache[name];
			});

			free(null, tree, url);
		});
	});
};

exports.parse = function(name, options, callback) {
	if (typeof options === 'function') return exports.parse(name, {}, options);
	if (cache[name] && cache[name].source) return callback(null, cache[name].source);

	options = options || {};

	exports.tree(name, function(err, tree, url) {
		if (err) return callback(err);

		cache[name].source = cache[name].source || compile(tree, url);

		callback(null, cache[name].source);
	});
};

var requireSource = function(source) {
	var module = {exports:{}};
	vm.runInNewContext(source, {console:console, module:module});
	return module.exports;
};

exports.render = function(name, locals, callback) {
	if (typeof locals === 'function') return exports.render(name, {}, locals);

	locals = locals || {};

	if (cache[name] && cache[name].render) {
		var result;

		try {
			result = cache[name].render(locals);
		} catch (err) {
			return callback(err);
		}

		return callback(null, result);
	}

	exports.parse(name, function(err, source) {
		if (err) return callback(err);

		try {
			cache[name].render = cache[name].render || requireSource(source);
		} catch (err) {
			return callback(err);
		}

		exports.render(name, locals, callback);
	});
};