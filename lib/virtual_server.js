
var fs = require('fs'),
	url = require('url'),
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
	readRequestStream(_req, function(_data) {
		try {
			_resp.statusCode = 200;
			var output = _match.ep.onRequest.call(_resp, _data, _req.headers, _req);
			if(output) {
				_resp.setHeader('content-type', 'text/json');
				_resp.write(JSON.stringify(output));
			}
			_resp.end();
		} catch(exc) {
			log.warn('Virtual: Server error while processing ' + _match.ep.method + ' ' + _match.ep.path);
			_resp.statusCode = 500;
			_resp.end();
		}
	}, function() {
		log.warn('Virtual: Invalid content');
		_resp.statusCode = 400;
		_resp.end();
	});
}

function serveStaticAsset(_resp, _path) {
	fs.readFile(_path, function (_err, _data) {
		if (_err) {
			log.warn('Virtual: static asset not found at: ' + _path);
			_resp.statusCode = 404;
			_resp.end();
		} else {
			log.info('Virtual: Serving crabtrap asset: ' + _path);
			_resp.statusCode = 200;
			_resp.setHeader('content-type', getFileContentType(_path));
			_resp.end(_data);
		}
	});
}

function buildVirtualServer(_domain, _staticPath, _apiDef) {
	return {
		handleRequest: function(_req, _resp) {
			var urlObj = url.parse(_req.url);
			if(urlObj.host != _domain) return false;

			_resp.setHeader('Access-Control-Allow-Origin', '*');

			log.info('Virtual: asset requested: ' + urlObj.path);

			var m = selectCgiAsset(_apiDef, _req.method, urlObj.path);
			if(m) {
				serveCgiAsset(m, _req, _resp);
			} else if(_req.method == 'GET') {
				serveStaticAsset(_resp, _staticPath + urlObj.path);
			} else {
				log.warn('Virtual: Asset not found for: ' + _req.method + ' ' + urlObj.path);
				_resp.statusCode = 404;
				_resp.end();
			}

			return true;
		}
	};
}

exports.build = buildVirtualServer;

