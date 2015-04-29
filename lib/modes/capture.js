var http = require('http'),
	https = require('https'),
	url = require('url'),
	Q = require('q'),
	log = require('../logger'),
	keysToLowerCase = require('../utils').keysToLowerCase;

exports.buildHandler = function(_memento) {
	return function(_req) {
		log.info('Forwarding ' + _req.method + ' request for ' + _req.url);

		var deferred = Q.defer(),
			urlObj = url.parse(_req.url),
			options = {
				method: _req.method,
				host: urlObj.host,
				path: urlObj.path,
				rejectUnauthorized: false,
				headers: keysToLowerCase(_req.headers)
			};

		// Rewrite headers
		options.headers['accept-encoding'] = 'gzip,deflate';
		log.debug(function() { return JSON.stringify(options); });

		var forward = (urlObj.protocol == 'https:' ? https : http).request(options, function(_fw_resp) {
			_memento.cache(_req, _fw_resp, function(_resource) {
				deferred.resolve(_resource.asProxyResponse());
			});
		});

		forward.on('error', function(_err) {
			log.warn('Problem with request: ' + _err.message);
			// TODO: forward proper error.
			deferred.resolve({
				code: 500
			});
		});

		_req.pipe(forward); // forward request data to real resource

		return deferred.promise;
	};
};