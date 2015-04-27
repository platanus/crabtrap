
var LEVEL = {
	DEBUG: 0,
	INFO: 1,
	WARN: 2,
	ERROR: 3
}, LOG_LEVEL = LEVEL.WARN;

function log(_level, _message) {
	if(_level == LEVEL.DEBUG) _message = '\t' + _message;
	if(_level >= LOG_LEVEL) console.log(_message);
}

exports.info = function(_msg) { log(LEVEL.INFO, _msg); };
exports.warn = function(_msg) { log(LEVEL.WARN, _msg); };