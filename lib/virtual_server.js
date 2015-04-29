
var fs = require('fs'),
	url = require('url'),
	Q = require('q'),
	log = require('./logger');

var EXT_TYPES = {
	"html"  : "text/html",
	"js"    : "application/javascript",
	"json"  : "application/json",
	"css"   : "text/css"
};

function getFileExt(_path) {
	var i = _path.lastIndexOf('.');
	return (i < 0) ? '' : _path.substr(i+1).toLowerCase();
}

function getFileContentType(_path) {
	return EXT_TYPES[getFileExt(_path)] || 'application/octet-stream';
}

function readRequestStream(_stream, _success, _error) {
	var data = '';

	_stream.on('data', function(_chunk) {
		data += _chunk;
	});

	_stream.on('end', function() {
		try {
			// TODO: parse depending on content type
			_success(data ? JSON.parse(data) : null);
		} catch(exc) {
			_error();
		}
	});
}

function selectCgiAsset(_endpoints, _method, _path) {
	for(var i = 0; i < _endpoints.length; i++) {
		if(_endpoints[i].method == _method && _endpoints[i].path == _path) {
			return { ep: _endpoints[i] };
		}
	}

	return false;
}

function serveCgiAsset(_match, _req, _resp) {
	var deferred = Q.defer();
	readRequestStream(_req, function(_data) {
		try {
			var response = { code: 200, headers: {} };
			var output = _match.ep.onRequest.call(_resp, _data, _req.headers, _req);
			if(output) {
				response.headers['content-type'] = 'text/json';
				response.content = JSON.stringify(output);
			}
			deferred.resolve(response);
		} catch(exc) {
			log.warn('Virtual: Server error while processing ' + _match.ep.method + ' ' + _match.ep.path);
			deferred.resolve({ code: 500 });
		}
	}, function() {
		log.warn('Virtual: Invalid content');
		deferred.resolve({ code: 400 });
	});

	return deferred.promise;
}

function serveStaticAsset(_path) {
	var deferred = Q.defer();
	fs.readFile(_path, function (_err, _data) {
		if (_err) {
			log.warn('Virtual: static asset not found at: ' + _path);
			deferred.resolve({ code: 404 });
		} else {
			log.info('Virtual: Serving crabtrap asset: ' + _path);
			deferred.resolve({
				code: 200,
				headers: {
					'content-type': getFileContentType(_path)
				},
				content: _data
			});
		}
	});

	return deferred.promise;
}

function buildVirtualServer(_domain, _options) {
	return function(_req) {
		var promise, urlObj = url.parse(_req.url);
		if(urlObj.host != _domain) return false;

		log.info('Virtual: asset requested: ' + urlObj.path);
		var cgiMatch = _options.cgi ? selectCgiAsset(_options.cgi, _req.method, urlObj.path) : null;

		if(cgiMatch) {
			promise = serveCgiAsset(cgiMatch, _req);
		} else if(_options.staticPath && _req.method == 'GET') {
			promise = serveStaticAsset(_options.staticPath + urlObj.path);
		} else {
			log.warn('Virtual: Asset not found for: ' + _req.method + ' ' + urlObj.path);
			promise = Q.when({
				code: 404
			});
		}

		return promise.then(function(_output) {
			if(!_output.headers) _output.headers = {};
			_output.headers['Access-Control-Allow-Origin'] = '*';
			return _output;
		});
	};
}

exports.buildHandler = buildVirtualServer;

