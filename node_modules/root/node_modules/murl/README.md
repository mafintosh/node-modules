# murl

murl is fast url pattern matching and replacing.
It's avaiable through npm:

	npm install murl

## What?

murl exposes a single function that accepts a pattern

``` js
var murl = require('murl');
var pattern = murl('/{hello}');
```

If you pass a string to the pattern murl will try and match it

``` js
pattern('/world') // -> {hello:'world'}
```

If you pass an object it will replace into the pattern

``` js
pattern({hello:'world'}) // -> '/world'
```

## Patterns

You can use `?` to specify a group as optional

`murl('/{hello}/{world}?')`: matches both `/a` and `/a/b`

Per default the `{}` groups matches until the next character or `/`.

`murl(/{hello})`: matches `/a` but not `/a/b`
`murl(/{wid}x{hei})`: matches `/200x200`

Use `*` to match anything

`murl('/*')`: matches `/a`, `/a/b/c` and so on


## License

MIT