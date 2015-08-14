var net = require('net'),
	http = require('http'),
	https = require('https'),
	url = require('url'),
	log = require('./logger');
	forOwn = require('./utils').forOwn;

// Maybe this key pair could be one of the proxy's arguments
var HTTPS_OPTIONS = {
	key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEAqiUzllMRy2ut6N88uFgqVPtv57kAPvoeA2H0ZpjGRJOvMq+/\njazG5HcmbRSrjT50bVoPxHzWCc1e2azrPnVSfqP8/3yN2IqPkzV5UF1nuTUGTwIn\n0a0ppIQm64+OsRwnRV+wMw8lWYV5HGTPkxL1qpyIuXkjJkeaonx0mulpxpWdfwVO\n6+lL8OlwKDaO+LiFfEa5n4z3WQTEu/damuxzbz6mwbiv3UdMV0us9cnhaJDoIUTJ\nf2F1An/cvAacfWLQhhKDBf44pXsKKo4o5+DPNp5HjKcfGj+s6+T3hjjqrzZDBc3G\nKC6rSvuAo++tPiEXXR3FFVh/u5/ITuXl2CJlTQIDAQABAoIBAQCbSECAnWfMI4Yg\n1jxwceaQkLlc3nbfAx6JL8kCKcQpqi9nLwa/okQTFrs3Kno2+h0AAAYL6XLel1RN\njYdVBXY4pimsclxymGLYkyEYu2aCnWYYjXsR3dv3jbSHoAk2kt80bVQ+BUCtJyeV\nRlw7ej5Da4FM5MWzlf4G9VbmWshyt3R7LCSCvZLrlfOR/p26StiTwB1kwqu8UBRm\ncWy8Qw7CX7Fy4bHUrYlpt/kPNznC9DK1dTfl1xSBIHO/3PGnI22gNe6C/dohlp8F\nlIEbHoXHzcYVlWApIA2msxtWzUxD0vjRPPqkXf+WARTGdSg8Wm6eNeiqksC3gMMi\nMxhhXHbxAoGBANPyJRQHxIzguZU77i7upd0nB7rvIR/4gyVT/Rcq7e6aUjIH6cBx\nWI7ixLfMssvL7U29ieBoj/5YiMrmtMykdT5uSzA0VcTFyEwlfYVk4OJeMFYCBH02\nniek16SCNcWMUSsJHBFTMW+f/9Me4yIRgmmYG6QAMCTYiBCDo1PgXbnjAoGBAM2C\nznXkfoBCztaF9l67/BSowYhIBXWxXcls/GySA148hniVf/TJiDKUEvBEf6JMGMRy\ndDKkWy+3aubk6chMBfJcp898MR6IDl4YBOq725vxJzG+1mEuSqytPWxywsbVNMk3\nNCWDGZoEloTlK9hdAe38L1CFXdvpx8WdURPBRUsPAoGAceknwm82VR0GwU1Xg0Pi\nQ00R24dgP0Wafrp4QTZicKXiXV9hY3vHw+vfHIXY5q1wmiKvcrvgACxnQN3j+ES/\netFeecb2/e3q6/oOT15be25x/hfRf9aWA+qVt6X/7m+uxDl+K1WSMVNF9JsaKhpN\nBCGrYWZ0eaki3/VQF+lzlk8CgYA/Df9i1LSrjdQApiGtd2gkvpKCyfZC4iSwhKv+\nc95sr41iuhwEc0FCo4QcDChNF6QRwjw8vYjs3w4BwgKo3gqFDkC+vJAlmgEuhZgc\nnX8IHbm03aTRNG7dBFpwR9XTQ99qTXHGgK7+PqIgLGCDhiXtaw7pWcIuk1AkJdyW\nfxpPqQKBgQDOqnXQ18KohUZ7BRPYscKZssn2alPIUd8EUZuMWxbx58mjNp91LP3T\nQ18hEbEyUNJ+8EKvq92e3Kt6WXLo9x7+Csov9Hcb5Q+ZJpP2rBngevh8ZQfnGwJ3\nd0bQYeTZIK2qM2REKO/zSdzyO7QT0Hxp/CcNqTiCBstodxubcBITRA==\n-----END RSA PRIVATE KEY-----\n',
	cert: '-----BEGIN CERTIFICATE-----\nMIIDjjCCAnagAwIBAgIJAIhVpe+vWvcSMA0GCSqGSIb3DQEBBQUAMDgxCzAJBgNV\nBAYTAkFVMRMwEQYDVQQIEwpTb21lLVN0YXRlMRQwEgYDVQQKEwtjcmFiZmFybS5p\nbzAeFw0xNTA4MTQyMDIxNDFaFw0xNjA4MTMyMDIxNDFaMDgxCzAJBgNVBAYTAkFV\nMRMwEQYDVQQIEwpTb21lLVN0YXRlMRQwEgYDVQQKEwtjcmFiZmFybS5pbzCCASIw\nDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAKolM5ZTEctrrejfPLhYKlT7b+e5\nAD76HgNh9GaYxkSTrzKvv42sxuR3Jm0Uq40+dG1aD8R81gnNXtms6z51Un6j/P98\njdiKj5M1eVBdZ7k1Bk8CJ9GtKaSEJuuPjrEcJ0VfsDMPJVmFeRxkz5MS9aqciLl5\nIyZHmqJ8dJrpacaVnX8FTuvpS/DpcCg2jvi4hXxGuZ+M91kExLv3Wprsc28+psG4\nr91HTFdLrPXJ4WiQ6CFEyX9hdQJ/3LwGnH1i0IYSgwX+OKV7CiqOKOfgzzaeR4yn\nHxo/rOvk94Y46q82QwXNxiguq0r7gKPvrT4hF10dxRVYf7ufyE7l5dgiZU0CAwEA\nAaOBmjCBlzAdBgNVHQ4EFgQUMCr3G4GFST8LDAIg5UAmC0uO/PgwaAYDVR0jBGEw\nX4AUMCr3G4GFST8LDAIg5UAmC0uO/PihPKQ6MDgxCzAJBgNVBAYTAkFVMRMwEQYD\nVQQIEwpTb21lLVN0YXRlMRQwEgYDVQQKEwtjcmFiZmFybS5pb4IJAIhVpe+vWvcS\nMAwGA1UdEwQFMAMBAf8wDQYJKoZIhvcNAQEFBQADggEBABbtLeVzPLO6YeJKj6RF\nQIVeqpXldYz3ijql6ZndcoCbTn0Qugjo50bP5DZMM2gADytYK0GgV3erwjyP9dIn\nYpFT9RzPvlIEJLiz8kh8YxplMONpEwscEH1e2n/FfK+XX0BVVUQxpFXj2REzaicL\nSOtlFzg7VDqIKgRAu+1LuiCgC01mRm8mSXqBq9JepBfpIu4kN6HCtOypqfIMVA7w\nOyRcve3PBjPJq7aY3QAdDs7x2axrHt+tL270AXFYUVU14i6Kl/sl8f+CzNmPr8a8\niQmJCARfEVFarDHrMFcvqNp8lzQywtDYj19NnCm05iZ0wX8jezYIa3XuDKulQPDq\nbrs=\n-----END CERTIFICATE-----\n'
};

function renderHandlerOutput(_output, _resp) {
	_resp.statusCode = _output.code;

	if(_output.headers) {
		forOwn(_output.headers, function(k, v) { _resp.setHeader(k, v); });
	}

	if(_output.content) {
		_resp.end(_output.content);
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

	close: function(_callback) {
		if(_callback) {
			this.server.on('close', _callback);
		}

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
