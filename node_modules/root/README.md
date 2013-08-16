# root

A super lightweight web framework with routing and prototype [mixin](https://github.com/mafintosh/protein) support.

It's available through npm:

	npm install root

## Usage

Usage is simple

``` js
var root = require('root');
var app = root();

app.get('/', function(request, response) {
	response.send({hello:'world'});
});
app.post('/echo', function(request, response) {
	request.on('json', function(body) {
		response.send(body);
	});
});
app.listen(8080);
```

You can extend the request and response with your own methods

``` js
app.use('response.time', function() {
	this.send({time:this.request.time});
});
app.use('request.time', {getter:true}, function() {
	return Date.now();
});

app.get(function(request, response) {
	response.time();
});
```

## Routing

Routing is done using [murl](https://github.com/mafintosh/murl).
Use the `get`, `post`, `put`, `del`, `patch` or `options` method to specify the HTTP method you want to route

``` js
app.get('/hello/{world}', function(request, response) {
	response.send({world:req.params.world});
});
app.get('/test', function(request, response, next) {
	// call next to call the next matching route
	next();
});
app.get('/test', function(request, response) {
	response.send('ok');
});
```

## URL normalization

Before routing an incoming url it is first decoded and normalized

* `/../../` ⇨ `/`
* `/foo/bar/../baz` ⇨ `/foo/baz`
* `/foo%20bar` ⇨ `/foo bar`
* `/foo%2fbar` ⇨ `/foo/bar`

This basicly means that you don't need to worry about `/..` attacks when serving files or similar.

## Error handling

You can specify an error handler for a specific error code by using the `error` function

``` js
app.get('/foo', function(request, response) {
	response.error(400, 'bad request man');
});

app.error(404, function(request, response) {
	response.send({error:'could not find route'});
});
app.error(function(req, res) {
	response.send({error:'catch all other errors'});
});
```

## Plugins

To create a plugin simply create a function that accepts an `app`

``` js
var plugin = function(app) {
	app.get('/my-plugin', function(request, response) {
		response.send('hello from plugin');
	});
};

myApp.use(plugin);
```

Alternatively you can pass a another app instance to `use`.

``` js
var subApp = root();

subApp.get('/test', function(request, response) {
	response.send('hello from sub app');
});

myApp.use(subApp); // route requests through subApp as well
```

## Available plugins

* [response.render](https://github.com/mafintosh/response.render) - PEJS template support
* [response.step](https://github.com/mafintosh/response.step) - Easy flow and error control

## License

MIT
