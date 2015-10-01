
var	fs = require('fs'),
	zlib = require('zlib'),
	url = require('url'),
	url = require('url'),
	log = require('./logger'),
	adiff = require('adiff'),
	forOwn = require('./utils').forOwn,
	clone = require('./utils').clone;

var M_VERSION = 0.2,
	PUSH_TIME = 24 * 60 * 60 * 1000,
	TEXT_REG = /^(text\/\w*|application\/(ecmascript|json|javascript|xml|x-javascript|x-markdown))(;\s?charset=UTF-8)?$/i;

function Memento() {
	this.stack = [];
	this.mods = arguments;

	// TODO: enable options as constructor parameters
	this.options = {
		urlMatchThresh: 0.75, // Use 1.0 to disable partial url matching
		contentMatchThresh: 0.75, // Use 1.0 to disable partial content matching
		matchEpsylon: 0.1 // results within 0.1 from max are considered candidates
	};
}

Memento.prototype = {

	loadFrom: function(_path, _success) {
		var data = fs.readFileSync(_path);
		zlib.gunzip(data, function(err, buffer) {
			if (!err) {
				var struct = JSON.parse(buffer.toString());

				log.debug(function() {
					return "Loading memento V" + struct.version + ", entries: " + struct.stack.length;
				});

				this.version = struct.version || 0.1;
				this.stack = struct.stack || struct;
				this.index = indexStack(this.stack);
			}

			_success();
		}.bind(this));
	},

	saveTo: function(_path, _success) {
		var data = JSON.stringify({
			version: M_VERSION,
			stack: this.stack
		});

		zlib.gzip(data, function(err, buffer) {
			if (!err) fs.writeFileSync(_path, buffer);
			_success();
		});
	},

	find: function(_req, _reqData) {
		_req.data = _reqData.toString('utf8');

		var	alike = searchIndex(this.index, _req),
		fullUrlMatches = [],
		partialUrlMatches = [];

		if(!alike) return null;

		for(var i = 0, l = alike.length; i < l; i++) {
			if(alike[i].url == _req.url) {
				fullUrlMatches.push(alike[i]);
			} else if(fullUrlMatches.length === 0) {
				partialUrlMatches.push(alike[i]);
			}
		}

		if(fullUrlMatches.length > 0) {
			return selectBest(this, fullUrlMatches, _req, true);
		} else if(partialUrlMatches.length > 0) {
			return selectBest(this, partialUrlMatches, _req, false);
		}

		return null;
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
			encoding: 'base64',
			ts: new Date().getTime()
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

function generateKey(_res) {
	var method = _res.method.toLowerCase(),
		parsedUrl = url.parse(_res.url, true);

	return method + ' ' + parsedUrl.hostname + '/' + parsedUrl.pathname;
}

function indexStack(_stack) {
	var index = {}, key, method, parsedUrl, alike;

	for(var i = 0, l = _stack.length; i < l; i++) {
		key = generateKey(_stack[i]);
		alike = index[key];
		if(!alike) alike = index[key] = [];
		alike.push(_stack[i]);
	}

	return index;
}

function searchIndex(_index, _req) {
	var key = generateKey(_req);
	return _index[key];
}

function selectBest(_memento, _candidates, _req, _skipUrlMatching) {

	log.debug(function() { return 'Candidates ' + _candidates.length; });

	if(!_skipUrlMatching) {
		filterBy('url', _candidates, _req, _memento.options.urlMatchThresh, _memento.options.matchEpsylon);
	}

	if(_req.method.toLowerCase() != 'get') {
		filterBy('data', _candidates, _req, _memento.options.contentMatchThresh, _memento.options.matchEpsylon);
	}

	var selected = selectByTs(_memento.refTs || 0, _candidates);
	if(selected) {
		_memento.refTs = selected.ts;
		selected.ts += PUSH_TIME;
		return new Resource(selected);
	} else {
		return null;
	}
}

function filterBy(_prop, _candidates, _req, _threshold, _epsylon) {
	var like, maxLike = null, i, l;

	for(i = 0, l = _candidates.length; i < l; i++) {
		if(!_candidates[i]) continue;
		like = lcsLike(_candidates[i][_prop], _req[_prop]);
		if(like < _threshold) {
			_candidates[i] = null;
		} else {
			if(!maxLike || like > maxLike) maxLike = like;
			_candidates[i].__like = like;
		}
	}

	for(i = 0; i < l; i++) {
		if(!_candidates[i]) continue;
		if((maxLike - _candidates[i].__like) > _epsylon) _candidates[i] = null;
	}
}

function selectByTs(_refTs, _candidates) {
	var best = null, minDelta, i, l;

	for(i = 0, l = _candidates.length; i < l; i++) {
		if(!_candidates[i]) continue;
		if(_candidates[i].ts === undefined) _candidates[i].ts = 0; // compat with older mementos
		if(!best || weightTs(best.ts, _refTs) > weightTs(_candidates[i].ts, _refTs)) {
			best = _candidates[i];
		}
	}

	return best;
}

function lcsLike(_stringA, _stringB) {
	// different length queries should never match, remove numeric values to make it more forgiving with timestamps
	if(_stringA.replace(/\d+/g,'') != _stringB.replace(/\d+/g,'')) return 0.0;
	var lcs = adiff.lcs(_stringA, _stringB).replace(/\,/g,''); // TODO: This is very slow!
	return lcs.length / _stringA.length;
}

function weightTs(_reference, _resource) {
	if(_reference > _resource) {
		return (_reference - _resource) * 5.0; // past resources get a penalty
	} else {
		return _resource - _reference;
	}
}

exports.Memento = Memento;