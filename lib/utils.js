
function forOwn(_obj, _cb) {
	for(var key in _obj) {
		if(_obj.hasOwnProperty(key)) {
			_cb(key, _obj[key]);
		}
	}
}

function clone(_obj) {
	if(!_obj) return _obj;
	return JSON.parse(JSON.stringify(_obj));
}

exports.forOwn = forOwn;
exports.clone = clone;