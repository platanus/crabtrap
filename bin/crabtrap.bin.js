#!/usr/bin/env node

var crabtrapI0 = require('../lib/domains/crabtrap_io'),
	localhost = require('../lib/domains/localhost'),
	Memento = require('../lib/memento').Memento,
	Proxy = require('../lib/proxy').Proxy,
	log = require('../lib/logger');

// Globals

var MODE = false,
	SOURCE = null,
	PORT = 4000,
	MAGIC_HOST = 'www.crabtrap.io',
	MEMENTO = new Memento(),
	HTML_REG = /^text\/html(;.*)?$/;

(function() {
	if(process.argv.length < 2) throw 'Must provide a proxy mode';
	MODE = process.argv[2];
	var i = 3;

	if(MODE != 'pass') {
		if(process.argv.length < 3) throw 'Must provide a bucket path';
		SOURCE = process.argv[3];
		i = 4;
	}

	for(; i < process.argv.length; i++) {
		var parts = process.argv[i].split('=');
		switch(parts[0]) {
			case '--port': PORT = parseInt(parts[1], 10); break;
			case '--quiet': PORT = parseInt(parts[1], 10); break;
			default: throw 'Invalid option ' + parts[0];
		}
	}
})();

function decorateHandler(_handler) {
	return function(_req) {
		var promise = _handler(_req);
		if(promise) {
			promise = promise.then(function(_output) {
				if(_output.content) {
					var contentType = _output.headers['content-type'];

					if(_output.encoding == 'utf-8' && contentType && HTML_REG.test(contentType)) {
						log.debug('Injecting capture ui!');
						_output.content = _output.content.replace(/<\/head>/i, (
							'<script src="https://' + MAGIC_HOST + '/selectorgadget_combined.js"\\></script>'+
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
	};
}

function buildProxy() {
	var proxy = new Proxy(PORT);
	proxy.addHandler(crabtrapI0.buildHandler(MAGIC_HOST));
	proxy.addHandler(localhost.buildHandler());

	switch(MODE) {
		case 'pass':
			proxy.addHandler(decorateHandler(require('../lib/modes/pass').buildHandler()));
			break;
		case 'capture':
			proxy.addHandler(decorateHandler(require('../lib/modes/capture').buildHandler(MEMENTO)));
			break;
		case 'replay':
			proxy.addHandler(decorateHandler(require('../lib/modes/replay').buildHandler(MEMENTO)));
			break;
		default: throw 'Invalid proxy mode';
	}

	return proxy;
}

var PROXY = buildProxy();

console.log("Starting crabtrap! mode: " + MODE);

if(MODE == 'replay') {
	MEMENTO.loadFrom(SOURCE, PROXY.listen.bind(PROXY));
} else {
	PROXY.listen();
}

var EXITING = false;
function finishGracefully() {
	if(EXITING) return;
	EXITING = true;

	console.log("Shutting down crabtrap!");
	PROXY.close();
	if(MODE == 'capture') {
		MEMENTO.saveTo(SOURCE, process.exit.bind(process));
	} else {
		process.exit();
	}
}

process.on('SIGTERM', finishGracefully);
process.on('SIGINT', finishGracefully);
