
var virtualServer = require('../virtual_server'),
	log = require('../logger');

exports.buildHandler = function() {
	return virtualServer.buildHandler(null, {
		cgi: [
			{
				method: 'GET',
				path: '/status',
				onRequest: function() {
					log.info('Agent: Status request received');
				}
			}
		]
	});
};
