var level = require("levelidb")
    , after = require("after")
    , toArray = require("write-stream/array")
    , db = level("/tmp/delete-range-simple", {
        createIfMissing: true
    })

    , deleteRange = require("../index")

var next = after(3, function () {
    deleteRange(db, {
        start: "foo:"
        , end: "foo;"
    }, function (err) {
        db.readStream()
            .pipe(toArray(function (list) {
                console.log("list", list)
            }))
    })
})

db.put("foo:1", { foo: "1" }, next)
db.put("foo:2", { foo: "2" }, next)
db.put("foo:3", { foo: "3" }, next)
