#!/usr/bin/env node

var net = require('net'),
	http = require('http'),
	https = require('https'),
	url = require('url'),
	fs = require('fs'),
	zlib = require('zlib');

// Globals

var HTTPS_OPTIONS = {
	key: '-----BEGIN RSA PRIVATE KEY-----\nMIIBOQIBAAJBAK/L/lXb/kxUzve1olo71s6mQLvuQCm3z2wqClq71NLerFnaXpN+\nFrNPy7+R3gZ1hdWXqbN5NqpWDMM9fcbd7p0CAwEAAQJAUDImN3Lhgl7Z/+TLSJCt\nwJ3VQCZC/QUOSdCv4o53Wy5aL/n8ootYFC3eoFC2Nal5bnH6onP9YR+X9l3HKLaT\n3QIhANXwb5SvJ+Kewa8F5wNHo9LFjSbL7WSSb1MyvYnOeFlPAiEA0lvaLz6UXRDL\n6T6Z1fkF0exmQqVimeL5qjY5o9Gk5lMCH1A52Z3oEQzqe7cmf3q7YrOnYUcrMdqF\nDzojzO/gfUECIQCe9fImiW+r9CljFH9Dhm6zd6S+8CNWjoKD8X4VITMvKQIgb3sg\nq9gPVzXn/+f8Qcc2KILSh3ffkIpA8yJK9omUIxI=\n-----END RSA PRIVATE KEY-----\n',
	cert: '-----BEGIN CERTIFICATE-----\nMIIBmDCCAUICCQDGtiGKgI9AXjANBgkqhkiG9w0BAQUFADBTMQswCQYDVQQGEwJD\nTDELMAkGA1UECBMCUk0xETAPBgNVBAcTCFNhbnRpYWdvMREwDwYDVQQKEwhQbGF0\nYW51czERMA8GA1UEAxMIQ3JhYnRyYXAwHhcNMTUwMTE1MjAxNzMzWhcNNDIwNjAx\nMjAxNzMzWjBTMQswCQYDVQQGEwJDTDELMAkGA1UECBMCUk0xETAPBgNVBAcTCFNh\nbnRpYWdvMREwDwYDVQQKEwhQbGF0YW51czERMA8GA1UEAxMIQ3JhYnRyYXAwXDAN\nBgkqhkiG9w0BAQEFAANLADBIAkEAr8v+Vdv+TFTO97WiWjvWzqZAu+5AKbfPbCoK\nWrvU0t6sWdpek34Ws0/Lv5HeBnWF1Zeps3k2qlYMwz19xt3unQIDAQABMA0GCSqG\nSIb3DQEBBQUAA0EAmecqIZqQ8OXSIj0V2VKaIXwz8RBnhLzU7BJwcsWJE/Bex7zB\nWP+vLv9ML5ZRLCsXjL5IOav8qAX/NZXjoN3e3Q==\n-----END CERTIFICATE-----\n'
};

var LOG = {
	DEBUG: 0,
	INFO: 1,
	WARN: 2,
	ERROR: 3
};

var STACK = [],
	MODE = false,
	SOURCE = null,
	PORT = 4000,
	LOG_LEVEL = LOG.WARN;

(function() {
	if(process.argv.length < 2) throw 'Must provide a proxy mode';
	MODE = process.argv[2];
	var i = 3;

	if(MODE != 'pass') {
		if(process.argv.length < 3) throw 'Must provide a bucket path';
		SOURCE = process.argv[3];
		i = 4;
	}

	for(; i < process.argv.length; i++) {
		var parts = process.argv[i].split('=');
		switch(parts[0]) {
			case '--port': PORT = parseInt(parts[1], 10); break;
			case '--quiet': PORT = parseInt(parts[1], 10); break;
			default: throw 'Invalid option ' + parts[0];
		}
	}
})();

// Utility methods

function log(_level, _message) {
	if(_level == LOG.DEBUG) _message = '\t' + _message;
	if(_level >= LOG_LEVEL) console.log(_message);
}

function forOwn(_obj, _cb) {
	for(var key in _obj) {
		if(_obj.hasOwnProperty(key)) {
			_cb(key, _obj[key]);
		}
	}
}

function keysToLowerCase(_obj) {
	var result = {};
	forOwn(_obj, function(k,v) { result[k.toLowerCase()] = v; });
	return result;
}

function pickRandomPort() {
	return 0; // This could fail on Linux...
}

function matchRequestToResource(_req, _resource) {
	return _resource.method.toLowerCase() == _req.method.toLowerCase() && _resource.url == _req.url;
}

function matchRequestToResourceWOQuery(_req, _resource) {
	if(_resource.method.toLowerCase() == _req.method.toLowerCase()) return false;

	var reqUrl = url.parse(_req.url, true),
		resUrl = url.parse(_resource.url, true);

	return reqUrl.hostname == resUrl.hostname && reqUrl.pathname == resUrl.pathname;
}

function findAndMoveLast(_req, _array, _matches) {
	for(var i = 0, l = _array.length; i < l; i++) {
		if(_matches(_req, _array[i])) {
			var resource = _array.splice(i, 1)[0];
			_array.push(resource);
			return resource;
		}
	}

	return null;
}

function loadStackFrom(_path, _then) {
	var data = fs.readFileSync(_path);
	zlib.gunzip(data, function(err, buffer) {
		if (!err) STACK = JSON.parse(buffer.toString());
		_then();
	});
}

function saveStackTo(_path, _then) {
	var data = JSON.stringify(STACK);
	zlib.gzip(data, function(err, buffer) {
		if (!err) fs.writeFileSync(_path, buffer);
		_then();
	});
}

function resolveAndServeResource(_req, _resp) {
	var resource = findInStack(_req);
	if(resource) {
		log(LOG.INFO, "Serving: " + resource.method + ' ' + resource.url);
		log(LOG.DEBUG, "HTTP " + resource.statusCode);
		log(LOG.DEBUG, JSON.stringify(resource.headers));

		serveResource(resource, _resp);
	} else {
		log(LOG.WARN, 'Not found: ' + _req.url);
		_resp.statusCode = 404;
		_resp.end();
	}
}

function serveLastResource(_resp) {
	serveResource(STACK[STACK.length-1], _resp);
}

function serveResource(_resource, _resp) {
	_resp.statusCode = _resource.statusCode;

	forOwn(_resource.headers, function(k, v) { _resp.setHeader(k, v); });

	if(_resource.content) {
		var buf = new Buffer(_resource.content, _resource.encoding);
		_resp.end(buf);
	} else {
		_resp.end();
	}
}

function findAndMoveLast(_req, _matches) {
	for(var i = 0, l = STACK.length; i < l; i++) {
		if(_matches(_req, STACK[i])) {
			var resource = STACK.splice(i, 1)[0];
			STACK.push(resource);
			return resource;
		}
	}

	return null;
}

function findInStack(_req, _partial) {
	return findAndMoveLast(_req, matchRequestToResource) ||
		findAndMoveLast(_req, matchRequestToResourceWOQuery);
}

function cacheResponse(_req, _resp, _cb) {

	log(LOG.INFO, "Caching Response");
	log(LOG.DEBUG, "HTTP " + _resp.statusCode);
	log(LOG.DEBUG, JSON.stringify(keysToLowerCase(_resp.headers)));

	var encoding = null,
		// TODO: consider storing port and protocoll in the resource.
		resource = {
			url: _req.url,
			statusCode: _resp.statusCode,
			method: _req.method,
			// inHeaders: req.headers, // store request headers to aid in recognition?
			headers: keysToLowerCase(_resp.headers),
			content: '',
			encoding: 'base64'
		},
		contentEncoding = resource.headers['content-encoding'],
		contentType = resource.headers['content-type'],
		outStream = _resp;

	// add decompression if supported encoding:
	if(contentEncoding == 'gzip') {
		outStream = _resp.pipe(zlib.createGunzip());
		delete resource.headers['content-encoding'];
		contentEncoding = null;
	} else if(contentEncoding == 'deflate') {
		outStream = _resp.pipe(zlib.createInflate());
		delete resource.headers['content-encoding'];
		contentEncoding = null;
	}

	// use utf8 encoding for uncompresed text:
	if(!contentEncoding && contentType) {
		contentType = contentType.match(/([^\/]+)\/([^\s]+)(?:\s+(.+))?/i);
		if(contentType && (contentType[1] == 'text' || contentType[1] == 'application')) {
			resource.encoding = 'utf-8';
		}
	}

	// remove unwanted headers:
	delete resource.headers['content-length'];

	// start receiving data:
	if(resource.encoding) outStream.setEncoding(resource.encoding);
	outStream.on('data', function(_chunk) {
		resource.content += _chunk;
	});

	// when all data is received, store resource (dont know how this will handle more than one request)
	outStream.on('end', function() {
		STACK.push(resource);
		_cb();
	});
}

function prepareForwardRequest(_req) {
	var urlObj = url.parse(_req.url);

	var options = {
		method: _req.method,
		host: urlObj.host,
		path: urlObj.path,
		rejectUnauthorized: false,
		headers: keysToLowerCase(_req.headers)
	};

	// Rewrite headers
	options.headers['accept-encoding'] = 'gzip,deflate';
	return options;
}

function passRequest(_req, _resp) {
	log(LOG.INFO, 'Passing through ' + _req.method + ' request for ' + _req.url);

	var urlObj = url.parse(_req.url);
	var forward = (urlObj.protocol == 'https:' ? https : http).request({
		method: _req.method,
		host: urlObj.host,
		path: urlObj.path,
		headers: _req.headers
	}, function(_fw_resp) {
		// pipe response back untouched
		_resp.writeHead(_fw_resp.statusCode, _fw_resp.headers);
		_fw_resp.pipe(_resp);
	});

	_req.pipe(forward);
}

function captureRequest(_req, _resp, _useSSL) {
	log(LOG.INFO, 'Forwarding ' + _req.method + ' request for ' + _req.url);

	var urlObj = url.parse(_req.url);
	var options = {
		method: _req.method,
		host: urlObj.host,
		path: urlObj.path,
		rejectUnauthorized: false,
		headers: keysToLowerCase(_req.headers)
	};

	// Rewrite headers
	options.headers['accept-encoding'] = 'gzip,deflate';
	log(LOG.DEBUG, JSON.stringify(options));

	var forward = (urlObj.protocol == 'https:' ? https : http).request(options, function(_fw_resp) {
		cacheResponse(_req, _fw_resp, function() {
			serveLastResource(_resp);
		});
	});

	_req.pipe(forward); // forward request data
}

function replayRequest(_req, _resp) {
	log(LOG.INFO, 'Resolving ' + _req.method + ' request for ' + _req.url);
	resolveAndServeResource(_req, _resp);
}

function selectProxy() {
	switch(MODE) {
		case 'pass': return passRequest;
		case 'capture': return captureRequest;
		case 'replay': return replayRequest;
		default: throw 'Invalid proxy mode';
	}
}

var PROXY_FUN = selectProxy(),
	SERVER = http.createServer(PROXY_FUN);

// Special handler for HTTPS request, creates a dedicated HTTPS proxy per connection,
// that way the CONNECT tunnel can be intercepted, requires support for self signed
// certificates in the client.
SERVER.on('connect', function (_req, _sock, _head) {

	var urlObj = url.parse('http://' + _req.url);
	log(LOG.INFO, 'New HTTPS request: starting https intercept on ' + urlObj.hostname);

	var httpsServ = https.createServer(HTTPS_OPTIONS, function(_req, _resp) {
		_req.url = 'https://' + urlObj.hostname + _req.url;
		PROXY_FUN(_req, _resp);
	});

	httpsServ.listen(pickRandomPort());

	var tunnelSock = net.connect(httpsServ.address().port, function() {
		_sock.write('HTTP/1.1 200 Connection Established\r\n' +
			'Proxy-agent: Node-Proxy\r\n' +
			'\r\n');
		tunnelSock.write(_head);
		tunnelSock.pipe(_sock);
		_sock.pipe(tunnelSock);
	});

	_sock.on('close', function() {
		httpsServ.close();
	});
});

console.log("Starting crabtrap! mode: " + MODE);

if(MODE == 'replay') {
	loadStackFrom(SOURCE, SERVER.listen.bind(SERVER, PORT));
} else {
	SERVER.listen(PORT);
}

var EXITING = false;
process.on('SIGINT', function() {
	if(EXITING) return;
	EXITING = true;

	console.log("Shutting down crabtrap!");
	SERVER.close();
	if(MODE == 'capture') {
		saveStackTo(SOURCE, process.exit.bind(process));
	} else {
		process.exit();
	}
});