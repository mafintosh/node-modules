var fs = require('fs');

var REVISION_HEAD = __dirname+'/../.git/refs/heads/master';

module.exports = {
	fingerprint: fs.existsSync(REVISION_HEAD) && fs.readFileSync(REVISION_HEAD, 'utf-8').trim(),
	github: {
		client: '6eda13aad78e1b1c4f5f',
		secret: process.env.GITHUB_SECRET
	},
	mongo: process.env.MONGO_AUTH+'@ds045628.mongolab.com:45628/node-modules',
	host: 'node-modules.com'
};