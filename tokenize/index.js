var IGNORE = require('./ignore');
var COMPOUNDS = require('./compounds');

var split = function(word) {
	return COMPOUNDS[word] || [word];
};

var flatten = function(result, words) {
	Array.prototype.push.apply(result, words);
	return result;
};

module.exports = function(str) {
	var visited = {};
	var sanitize = function(word) {
		if (!word || visited[word] || IGNORE[word]) return false;
		return visited[word] = true;
	};

	return str.toLowerCase().split(/[^a-z0-9@]+/).map(split).reduce(flatten, []).filter(sanitize);
};