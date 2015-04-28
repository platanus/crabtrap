
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

exports.forOwn = forOwn;
exports.keysToLowerCase = keysToLowerCase;