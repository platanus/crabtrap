#!/usr/bin/env node

var net = require('net'),
	http = require('http'),
	https = require('https'),
	url = require('url'),
	fs = require('fs'),
	zlib = require('zlib'),
	path = require('path');

var crabtrapI0 = require('../lib/domains/crabtrap_io'),
	Memento = require('../lib/memento').Memento,
	keysToLowerCase = require('../lib/utils').keysToLowerCase;

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
	LOG_LEVEL = LOG.WARN,
	MAGIC_HOST = 'www.crabtrap.io',
	IO_HANDLER = crabtrapI0.build(MAGIC_HOST),
	MEMENTO = new Memento();

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

function pickRandomPort() {
	return 0; // This could fail on Linux...
}

function buildErrorHandler(_resp) {
	return function(_err) {
		console.log('Problem with request: ' + _err.message);
		_resp.statusCode = 404;
		_resp.end();
	};
}

function passRequest(_req, _resp) {
	if(IO_HANDLER.handleRequest(_req, _resp)) return;

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

	forward.on('error', buildErrorHandler(_resp));

	_req.pipe(forward);
}

function captureRequest(_req, _resp, _useSSL) {
	if(IO_HANDLER.handleRequest(_req, _resp)) return;

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
		MEMENTO.cache(_req, _fw_resp, function(_resource) {
			_resource.serve(_resp);
		});
	});

	forward.on('error', buildErrorHandler(_resp));

	_req.pipe(forward); // forward request data
}

function replayRequest(_req, _resp) {
	if(IO_HANDLER.handleRequest(_req, _resp)) return;

	log(LOG.INFO, 'Resolving ' + _req.method + ' request for ' + _req.url);

	var resource = MEMENTO.find(_req);
	if(resource) {
		resource.serve(_resp);
	} else {
		log(LOG.WARN, 'Not found: ' + _req.url);
		_resp.statusCode = 404;
		_resp.end();
	}
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
	MEMENTO.loadFrom(SOURCE, process.exit.bind(process));
} else {
	SERVER.listen(PORT);
}

var EXITING = false;
function finishGracefully() {
	if(EXITING) return;
	EXITING = true;

	console.log("Shutting down crabtrap!");
	SERVER.close();
	if(MODE == 'capture') {
		MEMENTO.saveTo(SOURCE, process.exit.bind(process));
	} else {
		process.exit();
	}
}

process.on('SIGTERM', finishGracefully);
process.on('SIGINT', finishGracefully);
