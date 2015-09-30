var http = require('http'),
	https = require('https'),
	url = require('url'),
	Q = require('q'),
	log = require('../logger'),
	clone = require('../utils').clone,
	consumeDecodedRequest = require('../consumers').consumeDecodedRequest,
	consumeDecodedResponse = require('../consumers').consumeDecodedResponse;

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
				headers: clone(_req.headers)
			};

		// Rewrite headers
		options.headers['accept-encoding'] = 'gzip,deflate';
		options.headers['connection'] = 'close'; // keep-alive not supported yet

		log.debug(function() { return JSON.stringify(options); });

		consumeDecodedRequest(_req, function(_reqData) {

			var forward = (urlObj.protocol == 'https:' ? https : http).request(options, function(_fw_resp) {
				consumeDecodedResponse(_fw_resp, function(_respData) {
					var resource = _memento.cache(_req, _reqData, _fw_resp, _respData);
					deferred.resolve(resource.asProxyResponse());
				});
			});

			forward.on('error', function(_err) {
				log.warn('Problem with request: ' + _err.message);
				// TODO: forward proper error.
				deferred.resolve({
					code: 500
				});
			});

			forward.end(_reqData);
		});

		return deferred.promise;
	};
};