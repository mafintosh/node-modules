# PEJS

PEJS is pre-compiled EJS with a inheritance, blocks and file support that works both in the client and on the server.
It's available through npm:

	npm install pejs

## Usage

PEJS is easy to use:

``` js
var pejs = require('pejs');

pejs.render('./example.ejs', function(err, result) {
	// renders example.ejs into a string
	console.log(result);
});
pejs.parse('./example.ejs', function(err, src) {
	// parses the template and compiles it down to portable js
	// this means it works in the client!
	console.log(src);
});
```

PEJS has an internal cache of parsed templates which means that when you render a template
twice it will only parse it once.

It also makes sure to clear this cache if the template has changed in anyway on the disk

## Path resolution

PEJS uses a similar file/module resolution as node.js.

* `pejs.render('./file')`: pejs will look for `file.ejs`, `file.html`, `file/index.ejs` or `file/index.html`.
* `pejs.render('template')`: pejs will look for for `template` in in the nearest `views` folder using the same scheme as above.

This is almost exactly the same as node does with it's `node_modules` resolution.

## Classic EJS

PEJS templates has your usual EJS syntax with `<%` and `%>`. Read more about EJS [here](http://embeddedjs.com/)

* inline code: `<% var a = 42; %>`
* insert: `<%- data %>`
* escape: `<%= data %>`

## Blocks

PEJS expands the original EJS syntax by letting you declare blocks using the `<%{` syntax.
A block is basically a partial template that optionally can be loaded from a file.

* declare block: `<%{{ blockName }}%>`
* declare file block: `<%{ './filename.html' }%>`
* override block: `<%{ blockName %>hello block<%} %>`

In general all block can be loaded from a file instead of being defined inline by providing a filename:

* declare block: `<%{{ myBlock './example.ejs' }}%>`
* override block: `<%{ myOverrideBlock 'example.ejs' }%>`

If you want include a block using a different set of locals than in you current scope you pass these as the last argument to the block.

* declare block: `<%{{ myBlock {newLocalsArg:oldLocalsArg} }}%>`
* override block: `<%{ './example.ejs', newLocalsHere }%>`

All filepaths above are subject to the same path resolution as decribed in the previous section.

## Inheritance

Using blocks it's easy to implement template inheritance.
Just declare a `base.html` with some anchored blocks:

	<body>
		Hello i am base
		<%{{ content }}%>
	</body>

Then a `child.html` that renders `base.html`

	<%{ './base.html' }%>
	<%{ content %>
		i am inserted in base
	<%} %>

To render the example just render `child.html`

``` js
pejs.render('./child.html', function(err, result) {
	console.log(result);
});
```

The above outputs:

	<body>
		Hello i am base
		i am inserted in base
	</body>

## License

MIT
