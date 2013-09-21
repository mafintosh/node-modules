# node-modules.com

Search engine for node modules. Includes the frontend for [node-modules.com](http://node-modules.com).

## Installation

	# you need to have a mongodb instance running
	# if you do not have mongo installed follow the instructions on http://www.mongodb.org/
	git clone git@github.com:mafintosh/node-modules.git
	cd node-modules
	npm run setup-dev

The setup-dev script will fetch data module data from http://node-modules.com and put it into
your local mongodb database. If you don't want to do this run `npm install .` instead.

Run `npm run setup-dev` again to get the newest updates.

## Starting the server

	node . # starts a server on port 10000
	
If you need to start it on a different port pass `--port [port]`

## License

MIT
