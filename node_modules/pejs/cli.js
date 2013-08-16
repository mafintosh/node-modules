#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var pejs = require('./index');

var tree = process.argv.indexOf('--tree') > -1 || process.argv.indexOf('-t') > -1;
var compress = process.argv.indexOf('--compress') > -1 || process.argv.indexOf('-c') > -1;
var filename = process.argv.slice(2).filter(function(filename, i, filenames) {
	return filename[0] !== '-' && (filenames[i-1] || '')[0] !== '-';
})[0];

if (!filename) {
	console.error('usage: pejs filename');
	process.exit(1);
}

if (!fs.existsSync(filename)) {
	console.error(filename+' does not exist');
	process.exit(2);
}

filename = fs.realpathSync(filename);
pejs.compress = compress;

if (tree) {
	pejs.tree(filename, function(err, tree) {
		if (err) {
			console.error(err.message);
			process.exit(3);
		}
		console.log(JSON.stringify(tree));
	});
	return;
}

pejs.parse(filename, function(err, src) {
	if (err) {
		console.error(err.message);
		process.exit(3);
	}
	console.log(src);
});
