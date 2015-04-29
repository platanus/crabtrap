
var	fs = require('fs'),
	zlib = require('zlib'),
	url = require('url'),
	log = require('./logger'),
	forOwn = require('./utils').forOwn,
	keysToLowerCase = require('./utils').keysToLowerCase;

var TEXT_REG = /^(text\/\w*|application\/(ecmascript|json|javascript|xml|x-javascript|x-markdown))(;\s?charset=UTF-8)?$/i;

function matchRequestToResource(_req, _resource) {
	return _resource.method.toLowerCase() == _req.method.toLowerCase() && _resource.url == _req.url;
}

function matchRequestToResourceWOQuery(_req, _resource) {
	if(_resource.method.toLowerCase() == _req.method.toLowerCase()) return false;

	var reqUrl = url.parse(_req.url, true),
		resUrl = url.parse(_resource.url, true);

	return reqUrl.hostname == resUrl.hostname && reqUrl.pathname == resUrl.pathname;
}

function findAndMoveLast(_stack, _req, _matches) {
	for(var i = 0, l = _stack.length; i < l; i++) {
		if(_matches(_req, _stack[i])) {
			var resource = _stack.splice(i, 1)[0];
			_stack.push(resource);
			return new Resource(resource);
		}
	}

	return null;
}

function Resource(_parts) {
	this.parts = _parts;
}

Resource.prototype = {
	asProxyResponse: function() {
		return {
			code: this.parts.statusCode,
			headers: this.parts.headers,
			content: this.parts.content,
			encoding: this.parts.encoding
		};
	}
};

function Memento() {
	this.stack = [];
	this.mods = arguments;
}

Memento.prototype = {

	loadFrom: function(_path, _success) {
		var data = fs.readFileSync(_path);
		zlib.gunzip(data, function(err, buffer) {
			if (!err) this.stack = JSON.parse(buffer.toString());
			_success();
		}.bind(this));
	},

	saveTo: function(_path, _success) {
		var data = JSON.stringify(this.stack);
		zlib.gzip(data, function(err, buffer) {
			if (!err) fs.writeFileSync(_path, buffer);
			_success();
		});
	},

	find: function(_req) {
		return findAndMoveLast(this.stack, _req, matchRequestToResource) ||
			findAndMoveLast(this.stack, _req, matchRequestToResourceWOQuery);
	},

	cache: function(_req, _resp, _success) {

		log.info("Caching Response");
		log.debug("HTTP " + _resp.statusCode);
		log.debug(JSON.stringify(keysToLowerCase(_resp.headers)));

		var encoding = null,
			// TODO: consider storing port and protocol in the resource.
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
		if(!contentEncoding && contentType && TEXT_REG.test(contentType)) {
			resource.encoding = 'utf-8';
		}

		// remove unwanted headers:
		delete resource.headers['content-length'];
		delete resource.headers['transfer-encoding'];

		// start receiving data:
		if(resource.encoding) outStream.setEncoding(resource.encoding);
		outStream.on('data', function(_chunk) {
			resource.content += _chunk;
		});

		// when all data is received, store resource (dont know how this will handle more than one request)
		outStream.on('end', function() {
			this.stack.push(resource);
			_success(new Resource(resource));
		}.bind(this));
	}
};

exports.Memento = Memento;