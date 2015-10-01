#!/usr/bin/env node

var localhost = require('../lib/domains/localhost'),
	Memento = require('../lib/memento').Memento,
	Proxy = require('../lib/proxy').Proxy,
	log = require('../lib/logger');

// Globals

var DEFAULT_PORT = 4000,
	BLACKLISTED_URLS = [
		'http://stats.g.doubleclick.net/__utm.gif',
		'https://stats.g.doubleclick.net/__utm.gif'
	];

function renderHelp() {
	var pjson = require('../package.json');

	console.log('Crabtrap Proxy ' + pjson.version);
	console.log('####################\n');

	console.log('USAGE');
	console.log('\tcrabtrap [mode] [memento_path] [options]');

	console.log('MODES');
	console.log('\tcapture - proxy will capture requests into [memento_path]');
	console.log('\treplay  - proxy will replay requests from [memento_path]');
	console.log('\tpass    - pass through mode, no capture or replay is performed.');

	console.log('COMMANDS');
	console.log('\t--port    - Proxy port, defaults to ' + DEFAULT_PORT);
	console.log('\t--log     - Log level, valid levels are debug, info, warn and error, defaults to warn.');
	console.log('\t--virtual - Virtual domain asset path, if set, folder contents are made available at www.crabtrap.io.');

	console.log('\n');
}

(function() {

	if(process.argv.length < 2) return renderHelp();

	var proxyMode = process.argv[2],
		proxyPort = DEFAULT_PORT,
		memento = new Memento(),
		mementoPath = null,
		virtualPath = null,
		i = 3;

	if(proxyMode != 'pass') {
		if(process.argv.length < 3) return renderHelp();
		mementoPath = process.argv[3];
		i = 4;
	}

	for(; i < process.argv.length; i++) {
		var parts = process.argv[i].split('=');
		switch(parts[0]) {
			case '--port': proxyPort = parseInt(parts[1], 10); break;
			case '--log': log.setLevel(parts[1]); break;
			case '--virtual': virtualPath = parts[1]; break;
			default: throw 'Invalid option ' + parts[0];
		}
	}

	var proxy = new Proxy(proxyPort);
	proxy.setHandler('localhost', localhost.buildHandler());

	switch(proxyMode) {
		case 'pass':
			proxy.setHandler('proxy', require('../lib/modes/pass').buildHandler());
			break;
		case 'capture':
			proxy.setHandler('proxy', require('../lib/modes/capture').buildHandler(memento, BLACKLISTED_URLS));
			break;
		case 'replay':
			proxy.setHandler('proxy', require('../lib/modes/replay').buildHandler(memento));
			break;
		default: return renderHelp();
	}

	if(virtualPath) {
		var virtualServer = require('../lib/virtual/plugin');
		virtualServer.setupProxy(proxy, virtualPath);
	}

	console.log("Starting crabtrap! mode: " + proxyMode);

	if(proxyMode == 'replay') {
		memento.loadFrom(mementoPath, proxy.listen.bind(proxy));
	} else {
		proxy.listen();
	}

	var exiting = false;
	function finishGracefully() {
		if(exiting) return;
		exiting = true;

		console.log("Shutting down crabtrap!");
		proxy.close(function() {
			if(proxyMode == 'capture') {
				memento.saveTo(mementoPath, process.exit.bind(process));
			} else {
				process.exit();
			}
		});
	}

	process.on('SIGTERM', finishGracefully);
	process.on('SIGINT', finishGracefully);

})();
