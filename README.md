# node-modules

Search engine for node modules. Includes the frontend for [node-modules.com](http://node-modules.com).

## Installation

	git clone git@github.com:mafintosh/node-modules.git
	cd node-modules
	# fetch all the modules
	curl http://mathiasbuus.s3.amazonaws.com/public/db.tar.gz | tar xz
	npm install .

## Run

	node . # starts a server on port 10000

## Updating

To update the local registry you simple need to start the repl and call `update()`

	./repl
	update(); // will fetch all new/updated modules from npm