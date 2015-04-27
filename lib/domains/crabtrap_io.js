
var virtualServer = require('../virtual_server'),
	fs = require('fs'),
	path = require('path');
	log = require('../logger');

var STATIC_PATH = path.join(path.dirname(fs.realpathSync(__filename)), '../../static');

exports.build = function(_domain) {
	return virtualServer.build(_domain, STATIC_PATH, [
		{
			method: 'POST',
			path: '/api/logs',
			onRequest: function(_log) {
				log.warn('Agent: Interaction log received :' + JSON.stringify(_log));
				this.statusCode = 201;
			}
		},
		{
			method: 'GET',
			path: '/api/status',
			onRequest: function() {
				log.info('Agent: Status request received');
			}
		}
	]);
};
