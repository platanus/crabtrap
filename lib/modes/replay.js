var Q = require('q'),
	log = require('../logger'),
	consumeDecodedRequest = require('../consumers').consumeDecodedRequest;

exports.buildHandler = function(_memento) {
	return function(_req) {
		log.info('Resolving ' + _req.method + ' request for ' + _req.url);

		var deferred = Q.defer();

		consumeDecodedRequest(_req, function(_data) {
			var resource = _memento.find(_req, _data);
			if(resource) {
				deferred.resolve(resource.asProxyResponse());
			} else {
				log.warn('Not found: ' + _req.url);
				deferred.resolve({
					code: 404
				});
			}
		});

		return deferred.promise;
	};
};