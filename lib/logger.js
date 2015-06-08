
var LEVEL = {
	DEBUG: 0,
	INFO: 1,
	WARN: 2,
	ERROR: 3
}, LOG_LEVEL = LEVEL.WARN;

function log(_level, _message) {
	if(_level >= LOG_LEVEL) {
		if(typeof _message == 'function') _message = _message();
		if(_level == LEVEL.DEBUG) _message = '\t' + _message;
		console.log(_message);
	}
}

exports.debug = function(_msg) { log(LEVEL.DEBUG, _msg); };
exports.info = function(_msg) { log(LEVEL.INFO, _msg); };
exports.warn = function(_msg) { log(LEVEL.WARN, _msg); };
exports.error = function(_msg) { log(LEVEL.ERROR, _msg); };

exports.setLevel = function(_level) {
	switch(_level.toLowerCase()) {
	case 'debug':
		LOG_LEVEL = LEVEL.DEBUG;
		break;
	case 'info':
		LOG_LEVEL = LEVEL.INFO;
		break;
	case 'error':
		LOG_LEVEL = LEVEL.ERROR;
		break;
	default:
		LOG_LEVEL = LEVEL.WARN;
		break;
	}
};