# node-modules.com

Search engine for node modules. Includes the frontend for [node-modules.com](http://node-modules.com).

## Installation

	# run need to have a mongodb instance running
	git clone git@github.com:mafintosh/node-modules.git
	cd node-modules
	npm run setup-dev

The setup-dev script will fetch data module data from http://node-modules.com and put it into
your local mongodb database. If you don't want to do this run `npm install .` instead

## Starting the server

	node . # starts a server on port 10000

## License

MIT
