
var virtualServer = require('../virtual_server'),
	fs = require('fs'),
	path = require('path');
	log = require('../logger');

exports.buildHandler = function(_domain) {
	return virtualServer.buildHandler(_domain, {
		staticPath: path.join(path.dirname(fs.realpathSync(__filename)), '../../static'),
		cgi: [
			{
				method: 'POST',
				path: '/api/logs',
				onRequest: function(_log) {
					log.warn('Agent: Interaction log received :' + JSON.stringify(_log));
					this.statusCode = 201;
				}
			}
		]
	});
};
