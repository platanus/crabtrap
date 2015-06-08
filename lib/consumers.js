
var zlib = require('zlib'),
	log = require('./logger');

var TEXT_REG = /^(text\/\w*|application\/(ecmascript|json|javascript|xml|x-javascript|x-markdown))(;\s?charset=UTF-8)?$/i;

function consumeDecodedRequest(_req, _ready) {
	var data = [];

	_req.on('data', function(_chunk) {
		data.push(_chunk);
	});

	_req.on('end', function() {
		var buffer = Buffer.concat(data);
		_ready(Buffer.concat(data));
	});
}

function consumeDecodedResponse(_resp, _ready) {

	var contentEncoding = _resp.headers['content-encoding'],
		contentType = _resp.headers['content-type'],
		outStream = _resp,
		data = [];

	// add decompression if supported encoding:
	if(contentEncoding == 'gzip') {
		outStream = _resp.pipe(zlib.createGunzip());
		delete _resp.headers['content-encoding'];
		contentEncoding = null;
	} else if(contentEncoding == 'deflate') {
		outStream = _resp.pipe(zlib.createInflate());
		delete _resp.headers['content-encoding'];
		contentEncoding = null;
	}

	// remove unwanted headers:
	delete _resp.headers['content-length'];
	delete _resp.headers['transfer-encoding'];

	// start receiving data:
	outStream.on('data', function(_chunk) {
		data.push(_chunk);
	});

	outStream.on('end', function() {
		_ready(Buffer.concat(data));
	});
}

exports.consumeDecodedRequest = consumeDecodedRequest;
exports.consumeDecodedResponse = consumeDecodedResponse;