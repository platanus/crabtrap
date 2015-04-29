var fs = require('fs'),
	path = require('path'),
	virtualServer = require('../virtual_server'),
	log = require('../logger');

var MAGIC_HOST = 'www.crabtrap.io',
	HTML_REG = /^text\/html(;.*)?$/;

exports.setupProxy = function(_proxy) {

	// Add crabtrap.io domain handler:
	_proxy.setHandler(MAGIC_HOST, virtualServer.buildHandler(MAGIC_HOST, {
		staticPath: path.join(path.dirname(fs.realpathSync(__filename)), './assets'),
		cgi: [
			{
				method: 'POST',
				path: '/api/logs',
				onRequest: function(_log) {
					log.warn('Agent: Interaction log received :' + JSON.stringify(_log));
					this.statusCode = 201;
				}
			}
		]
	}), { after: 'localhost' });

	// Add html asset injector:
	_proxy.setHandler('proxy', function(_req, _super) {
		var promise = _super(_req);
		if(promise) {
			promise = promise.then(function(_output) {
				if(_output.content) {
					var contentType = _output.headers['content-type'];

					if(_output.encoding == 'utf-8' && contentType && HTML_REG.test(contentType)) {
						log.debug('Injecting capture ui!');
						_output.content = _output.content.replace(/<\/head>/i, (
							'<script src="https://' + MAGIC_HOST + '/selectorgadget_combined.min.js"\\></script>'+
							'<script src="https://' + MAGIC_HOST + '/inject.js"\\></script>'+
							'<link href="https://' + MAGIC_HOST + '/selectorgadget_combined.css" media="all" rel="stylesheet">'+
							'</head>'
						));
					}
				}

				return _output;
			});
		}

		return promise;
	});

};