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