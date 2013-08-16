# find-module

Find a module specified by a require path asynchronously using Node's module resolution.

	npm install find-module

## Usage

``` js
var findModule = require('find-module');

findModule('./some-path', {
	dirname: 'some-parent-dir' // the directory from which ./some-path should be resolved
}, function(err, filename) {
	console.log('some-path resolved to '+filename+' from some-parent-dir');
});
```

If you pass a module path (`'my-module'`) find-module by default will look for a `node_modules` folder
to find `my-module`. If you want to use a different module folder you can set the `modules` option

``` js
findModule('my-module', {
	modules: 'custom_modules',
	dirname: 'some-parent-dir'
}, ...);
```

When you resolve a path find-module by default will look for `path+'.js'` and `path+'.json'` if the
path does not exist. If you want to look for other kind of extensions set the `extensions` option

``` js
findModule('my-module', {
	dirname: 'some-parent-dir',
	extensions: ['txt']
}, ...);
```

Combine the `modules` and `extensions` settings to roll out your own module finder. A template module
finder could look like this

``` js
findModule('my-template', {
	dirname: 'some-parent-dir',
	modules: 'templates',
	extensions: ['html']
}, ...);
```

## License

MIT