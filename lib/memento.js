
var	fs = require('fs'),
	zlib = require('zlib'),
	url = require('url'),
	url = require('url'),
	log = require('./logger'),
	adiff = require('adiff'),
	forOwn = require('./utils').forOwn,
	clone = require('./utils').clone;

var TEXT_REG = /^(text\/\w*|application\/(ecmascript|json|javascript|xml|x-javascript|x-markdown))(;\s?charset=UTF-8)?$/i;

function Memento() {
	this.stack = [];
	this.mods = arguments;

	// TODO: enable options as constructor parameters
	this.options = {
		simulateCausality: true, // set to true to rotate stack keeping resource ordering
		urlMatchThresh: 0.75, // Use 1.0 to disable partial url matching
		contentMatchThresh: 0.75 // Use 1.0 to disable partial content matching
	};
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

	find: function(_req, _reqData) {
		_req.data = _reqData.toString('utf8');
		return findAndRotate(this, _req);
	},

	cache: function(_req, _reqData, _resp, _respData) {

		log.info("Caching Response");
		log.debug("HTTP " + _resp.statusCode);
		log.debug(function() { return JSON.stringify(_resp.headers); });

		// TODO: consider storing port and protocol in the resource.
		resource = {
			url: _req.url,
			statusCode: _resp.statusCode,
			method: _req.method,
			// inHeaders: req.headers, // store request headers to aid in recognition?
			data: _reqData.toString('utf8'), // not sure how safe is this....
			headers: clone(_resp.headers),
			content: _respData.toString('base64'),
			encoding: 'base64'
		};

		this.stack.push(resource);
		return new Resource(resource);
	}
};

function Resource(_parts) {
	this.parts = _parts;
}

Resource.prototype = {
	asProxyResponse: function() {
		return {
			code: this.parts.statusCode,
			headers: this.parts.headers,
			content: new Buffer(this.parts.content, this.parts.encoding)
		};
	}
};

function findAndRotate(_memento, _req) {
	var	stack = _memento.stack,
		method = _req.method.toLowerCase(),
		contentScoring = [],
		urlScoring = [],
		partialUrlMatching = _memento.options.urlMatchThresh < 1.0,
		partialContentMatching = _memento.options.contentMatchThresh < 1.0;

	for(var i = 0, l = stack.length; i < l; i++) {
		if(stack[i].method.toLowerCase() != method) continue; // if methods do not match continue

		if(exactUrlMatch(_req, stack[i])) {
			if(_req.data == stack[i].data) return selectAndRotate(_memento, i);
			if(_req.data && stack[i].data) {
				if(partialContentMatching) contentScoring.push(i);
				continue;
			}
		}

		if(partialUrlMatching && partialUrlMatch(_req, stack[i])) {
			if(contentScoring.length === 0) urlScoring.push(i);
		}
	}

	if(contentScoring.length > 0) {
		return selectBestByContent(_memento, contentScoring, _req);
	} else if(urlScoring.length > 0) {
		return selectBestByUrl(_memento, urlScoring, _req);
	}

	return null;
}

function selectAndRotate(_memento, _index) {
	var stack = _memento.stack, rawResource;

	if(_memento.options.simulateCausality) {
		stack.push.apply(stack, stack.splice(0, _index+1));
		rawResource = stack[stack.length-1];
	} else {
		rawResource = stack.splice(_index, 1)[0];
		stack.push(rawResource);
	}

	return new Resource(rawResource);
}

function selectBestByContent(_memento, _indexes, _req) {
	var stack = _memento.stack,
		best = _indexes[0],
		maxLike = 0.0,
		like;

	for(var i = 0, l = _indexes.length; i < l; i++) {
		like = lcsLike(stack[_indexes[i]].data, _req.data);
		if(maxLike < like) {
			maxLike = like;
			best = _indexes[i];
		}
	}

	log.debug(function() { return 'Best content match was ' + stack[best].url + ' (' + maxLike + ' L)'; });

	return maxLike > _memento.options.contentMatchThresh ? selectAndRotate(_memento, best) : null;
}

function selectBestByUrl(_memento, _indexes, _req) {

	var stack = _memento.stack,
		best = _indexes[0],
		maxLike = 0.0,
		like;

	for(var i = 0, l = _indexes.length; i < l; i++) {
		like = lcsLike(stack[_indexes[i]].url, _req.url);
		// TODO: also consider content: like *= lcsLike(stack[_indexes[i]].data || '', _req.data || '');
		if(maxLike < like) {
			maxLike = like;
			best = _indexes[i];
		}
	}

	log.debug(function() { return 'Best url match was ' + stack[best].url + ' (' + maxLike + ' L)'; });

	return maxLike > _memento.options.urlMatchThresh ? selectAndRotate(_memento, best) : null;
}


function exactUrlMatch(_req, _resource) {
	return _resource.url == _req.url;
}

function partialUrlMatch(_req, _resource) {
	var reqUrl = url.parse(_req.url, true),
		resUrl = url.parse(_resource.url, true);

	return reqUrl.hostname == resUrl.hostname && reqUrl.pathname == resUrl.pathname;
}

function lcsLike(_stringA, _stringB) {
	// TODO: consider using diff instead of proportion

	var lcsLength = adiff.lcs(_stringA, _stringB).replace(',','').length,
		diffA = lcsLength / _stringA.length,
		diffB = lcsLength / _stringB.length;

	return diffA * diffB;
}

exports.Memento = Memento;