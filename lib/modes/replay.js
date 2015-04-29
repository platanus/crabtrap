var Q = require('q'),
	log = require('../logger');

exports.buildHandler = function(_memento) {
	return function(_req) {
		log.info('Resolving ' + _req.method + ' request for ' + _req.url);

		var resource = _memento.find(_req);
		if(resource) {
			return Q.when(resource.asProxyResponse());
		} else {
			log.warn('Not found: ' + _req.url);
			return Q.when({
				code: 404
			});
		}
	};
};