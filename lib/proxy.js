var net = require('net'),
	http = require('http'),
	https = require('https'),
	url = require('url'),
	log = require('./logger');
	forOwn = require('./utils').forOwn;

// Maybe this key pair could be one of the proxy's arguments
var HTTPS_OPTIONS = {
	key: '-----BEGIN RSA PRIVATE KEY-----\nMIIBOQIBAAJBAK/L/lXb/kxUzve1olo71s6mQLvuQCm3z2wqClq71NLerFnaXpN+\nFrNPy7+R3gZ1hdWXqbN5NqpWDMM9fcbd7p0CAwEAAQJAUDImN3Lhgl7Z/+TLSJCt\nwJ3VQCZC/QUOSdCv4o53Wy5aL/n8ootYFC3eoFC2Nal5bnH6onP9YR+X9l3HKLaT\n3QIhANXwb5SvJ+Kewa8F5wNHo9LFjSbL7WSSb1MyvYnOeFlPAiEA0lvaLz6UXRDL\n6T6Z1fkF0exmQqVimeL5qjY5o9Gk5lMCH1A52Z3oEQzqe7cmf3q7YrOnYUcrMdqF\nDzojzO/gfUECIQCe9fImiW+r9CljFH9Dhm6zd6S+8CNWjoKD8X4VITMvKQIgb3sg\nq9gPVzXn/+f8Qcc2KILSh3ffkIpA8yJK9omUIxI=\n-----END RSA PRIVATE KEY-----\n',
	cert: '-----BEGIN CERTIFICATE-----\nMIIBmDCCAUICCQDGtiGKgI9AXjANBgkqhkiG9w0BAQUFADBTMQswCQYDVQQGEwJD\nTDELMAkGA1UECBMCUk0xETAPBgNVBAcTCFNhbnRpYWdvMREwDwYDVQQKEwhQbGF0\nYW51czERMA8GA1UEAxMIQ3JhYnRyYXAwHhcNMTUwMTE1MjAxNzMzWhcNNDIwNjAx\nMjAxNzMzWjBTMQswCQYDVQQGEwJDTDELMAkGA1UECBMCUk0xETAPBgNVBAcTCFNh\nbnRpYWdvMREwDwYDVQQKEwhQbGF0YW51czERMA8GA1UEAxMIQ3JhYnRyYXAwXDAN\nBgkqhkiG9w0BAQEFAANLADBIAkEAr8v+Vdv+TFTO97WiWjvWzqZAu+5AKbfPbCoK\nWrvU0t6sWdpek34Ws0/Lv5HeBnWF1Zeps3k2qlYMwz19xt3unQIDAQABMA0GCSqG\nSIb3DQEBBQUAA0EAmecqIZqQ8OXSIj0V2VKaIXwz8RBnhLzU7BJwcsWJE/Bex7zB\nWP+vLv9ML5ZRLCsXjL5IOav8qAX/NZXjoN3e3Q==\n-----END CERTIFICATE-----\n'
};

function renderHandlerOutput(_output, _resp) {
	_resp.statusCode = _output.code;

	if(_output.headers) {
		forOwn(_output.headers, function(k, v) { _resp.setHeader(k, v); });
	}

	if(_output.content) {
		_resp.end(_output.content, _output.encoding);
	} else if(_output.contentStream) {
		_output.contentStream.pipe(_resp);
	} else {
		_resp.end();
	}
}

function handleRequest(_req, _resp, _handlers) {
	var handler, promise = null;

	for(var i = 0; (handler = _handlers[i]); i++) {
		promise = handler.fun(_req);
		if(promise) break;
	}

	if(promise) {
		// pass control to handler (scary...)
		promise.then(function(_output) {
			renderHandlerOutput(_output, _resp);
		}, function(_err) {
			renderHandlerOutput({ code: 500 }, _resp);
		}).catch(function(_exc) {
			log.error('Fatal exception while handling request:' + _exc);
			renderHandlerOutput({ code: 500 }, _resp);
		});
	} else {
		// TODO: render error code if no handler could process the request.
	}
}

function pickRandomPort() {
	return 0; // This could fail on Linux...
}

function setupHttpsTrapFor(_server, _onRequest) {
	_server.on('connect', function (_req, _sock, _head) {
		var urlObj = url.parse('http://' + _req.url);
		log.info('New HTTPS request: starting https intercept on ' + urlObj.hostname);

		var httpsServ = https.createServer(HTTPS_OPTIONS, function(_req, _resp) {
			_req.url = 'https://' + urlObj.hostname + _req.url;
			_onRequest(_req, _resp);
		});

		httpsServ.listen(pickRandomPort());

		var tunnelSock = net.connect(httpsServ.address().port, function() {
			_sock.write('HTTP/1.1 200 Connection Established\r\n' +
				'Proxy-agent: Crabtrap-Proxy\r\n' +
				'\r\n');
			tunnelSock.write(_head);
			tunnelSock.pipe(_sock);
			_sock.pipe(tunnelSock);
		});

		_sock.on('close', function() {
			httpsServ.close();
		});
	});
}

function indexOfHandler(_handlers, _name) {

	for(var i = 0; i < _handlers.length; i++) {
		if(_handlers[i].name == _name) return i;
	}

	return -1;
}

function overrideHandler(_super, _other) {
	return function(_req) {
		return _other(_req, _super);
	};
}

function Proxy(_port) {
	this.port = _port;
	this.handlers = [];

	var proxyFun = function(_req, _resp) {
		handleRequest(_req, _resp, this.handlers);
	}.bind(this);

	this.server = http.createServer(proxyFun);
	setupHttpsTrapFor(this.server, proxyFun);
}

Proxy.prototype = {
	listen: function() {
		this.server.listen(this.port);
	},

	close: function() {
		this.server.close();
	},

	setHandler: function(_name, _handlerFun, _options) {
		var at = indexOfHandler(this.handlers, _name);
		if(at != -1) {
			_handlerFun = overrideHandler(this.handlers[at].fun, _handlerFun);
			this.handlers.splice(at, 1);
		}

		var ref = (_options && (_options.after || _options.before));
		if(ref) {
			at = indexOfHandler(this.handlers, ref);
			if(at == -1) throw 'Reference handler \'' + ref + '\' not found';
			if(_options.after) at += 1;
		}

		if(at == -1) {
			at = this.handlers.length;
			this.handlers.push({ name: _name, fun: _handlerFun });
		} else {
			this.handlers.splice(at, 0, { name: _name, fun: _handlerFun });
		}

		return at;
	},

	getHandler: function(_name) {
		var at = indexOfHandler(this.handlers, _name);
		return at == -1 ? null : this.handlers[at].fun;
	}
};

exports.Proxy = Proxy;
