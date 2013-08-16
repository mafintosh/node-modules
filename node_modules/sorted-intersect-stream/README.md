# sorted-intersect-stream

Intersect two streams that emit sorted data

	npm install sorted-intersect-stream

This module is similar to [sorted-intersect](https://github.com/mafintosh/sorted-intersect)
except this intersects streams that emit sorted data instead of arrays of sorted data

## Usage

It is easy to use

``` js
var intersect = require('sorted-intersect-stream');
var es = require('event-stream'); // npm install event-stream

// es.readArray converts an array into a stream
var sorted1 = es.readArray([0,10,24,42,43,50,55]);
var sorted2 = es.readArray([10,42,53,55,60]);

// combine the two streams into a single intersected stream
var intersection = intersect(sorted1, sorted2);

intersection.on('data', function(data) {
	console.log('intersected at '+data);
});
intersection.on('end', function() {
	console.log('no more intersections');
});
```

Running the above example will print

```
intersected at 10
intersected at 42
intersected at 55
no more intersections
```

When the intersection ends the two input streams will be destroyed. Set`intersection.autoDestroy = false` to disable this.

## Streaming objects

If you are streaming objects you should add a `toKey` function as the third parameter.
`toKey` should return an key representation of the data that can be used to compare objects.

_The keys MUST be sorted_

``` js
var sorted1 = es.readArray([{key:'a'}, {key:'b'}, {key:'c'}]);
var sorted2 = es.readArray([{key:'b'}, {key:'d'}]);

var intersection = intersect(sorted1, sorted2, function(data) {
	return data.key; // data.key is sorted
});

intersection.on('data', function(data) {
	console.log(data); // will print {key:'b'}
});
```

A good use-case for this kind of module is implementing something like full-text search where you want to
intersect multiple index hits.

## Intersecting LevelDB streams

Since [levelup](https://github.com/rvagg/node-levelup) streams are sorted in relation to their keys it is
easy to intersect them using sorted-intersect-stream.

If we wanted to intersect two namespaces `foo` and `bar` we could do it like so

``` js
var db = levelup('mydatabase', {valueEncoding:'json'});

var foo = db.createReadStream({
	start: 'foo:',
	end: 'foo;'
});

var bar = db.createReadStream({
	start: 'bar:',
	end: 'bar;'
});

var intersection = intersect(foo, bar, function(data) {
	// remove the namespace from the keys so they are comparable
	return data.key.split(':').slice(1).join(':');
});
```

## License

MIT
