var http = require('http'),
	https = require('https'),
	url = require('url'),
	Q = require('q'),
	log = require('../logger');

exports.buildHandler = function() {
	return function(_req) {
		log.info('Passing through ' + _req.method + ' request for ' + _req.url);

		var deferred = Q.defer(),
			urlObj = url.parse(_req.url);

		var forward = (urlObj.protocol == 'https:' ? https : http).request({
			method: _req.method,
			host: urlObj.host,
			path: urlObj.path,
			headers: _req.headers
		}, function(_fw_resp) {
			// piping response back untouched as stream wont allow
			// response injections that rely on decoded content. (like in capture or replay)
			deferred.resolve({
				code: _fw_resp.statusCode,
				headers: _fw_resp.headers,
				contentStream: _fw_resp
			});
		});

		forward.on('error', function(_err) {
			console.log('Problem with request: ' + _err.message);
			deferred.resolve({ code: 500 });
		});

		_req.pipe(forward);

		return deferred.promise;
	};
};