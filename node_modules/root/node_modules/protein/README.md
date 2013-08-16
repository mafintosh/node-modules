# Protein

Protein is http prototype mixins for Node.js

It's available through npm:

	npm install protein

# Example

``` js
var protein = require('protein');
var url = require('url');

var mixin = protein()
	.use('request.query', {getter:true}, function() {
		return this._query || (this.query = url.parse(this.url, true).query);
	})
	.use('response.echo', function(data) {
		return this.end(JSON.stringify(data));
	});

var listener = function(request, response) {
	mixin(request, response);
	response.echo(request.query);
};

require('http').createServer(listener).listen(8080);
```

# Wat?

If we rewrite the above example using [Connect](https://github.com/senchalabs/connect) it would look like.

``` js
var connect = require('connect');
var url = require('url');

var fn = connect()
	.use(function(request, response, next) {
		request.query = url.parse(request.url, true).query;
		next();
	})
	.use(function(request, response, next) {
		response.echo = function() {
			response.end(JSON.stringify(request.query));
		};
		next();
	})
	.use(function(request, response) {
		// Explained below
		response.end('hello world');
	});

require('http').createServer(fn).listen(8080);
```

But if we look closer at the above example we are actually parsing the query on every request even though we never use it.
Wouldn't it be nicer to just parse when we access it?

Using Protein we can just define a getter on the mixin prototype:

``` js
var mixin = protein()
	.use('request.query', {getter:true}, function() {
		return this._query || (this._query = url.parse(request.url, true).query);
	})
	.use( ... )
```

Now when we access request.query the first time the query will be parsed and in all other cases no parsing happens.
Notice Protein is actually defining the getter on the mixin prototype so it's actually only defined once - *NOT* every request.

Similary we could just define `echo` on the mixin prototype instead of defining it on every request:

``` js
var mixin = protein()
	.use('request.query', {getter:true}, function() {
		return this._query || (this._query = url.parse(request.url, true).query);
	})
	.use('response.echo', function() {
		this.end(JSON.stringify(request.query));
	})
```

Note that we are only expanding the mixin prototype and not the prototype from the `http` module so there should be zero side effects.
The final program just looks like this:

``` js
var protein = require('protein');
var url = require('url');

var mixin = protein()
	.use('request.query', {getter:true}, function() {
		return this._query || (this.query = url.parse(this.url, true).query);
	})
	.use('response.echo', function(data) {
		return this.end(JSON.stringify(data));
	});

var listener = function(request, response) {
	mixin(request, response);
	response.echo('hello world');
};

require('http').createServer(listener).listen(8080);
```

# Connect compatibility

Protein mixins are directly compatible with connect making then easy to use with your express application:

``` js
var app = express();

var mixin = protein().use('response.echo', ...);

app.use(mixin);
```

# License

**This software is licensed under "MIT"**

> Copyright (c) 2012 Mathias Buus Madsen <mathiasbuus@gmail.com>
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
