# node-modules.com

Search engine for node modules. Includes the frontend for [node-modules.com](http://node-modules.com).

## Installation

	git clone git@github.com:mafintosh/node-modules.git
	cd node-modules
	npm install .

## Updating modules

After you have installed you need to install a mongo server (will setup a dev server)
To insert some data into this database run `node update` in the repo

	node update // will fetch all new/updated modules from npm

## Starting the server

	node . # starts a server on port 10000
