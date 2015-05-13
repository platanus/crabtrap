var fs = require('fs'),
	path = require('path'),
	virtualServer = require('../virtual_server'),
	log = require('../logger');

var MAGIC_HOST = 'www.crabtrap.io',
	HTML_REG = /^text\/html(;.*)?$/;

exports.setupProxy = function(_proxy, _path) {

	// TODO: search inside path for a cgi.js file and load api from it

	// Add crabtrap.io domain handler:
	_proxy.setHandler(MAGIC_HOST, virtualServer.buildHandler(MAGIC_HOST, {
		staticPath: _path
	}), { after: 'localhost' });
};