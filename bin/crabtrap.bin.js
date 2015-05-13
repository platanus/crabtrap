#!/usr/bin/env node

var localhost = require('../lib/domains/localhost'),
	Memento = require('../lib/memento').Memento,
	Proxy = require('../lib/proxy').Proxy,
	log = require('../lib/logger');

// Globals

var SOURCE = null,
	PORT = 4000,
	MEMENTO = new Memento(),
	VIRTUAL = null;

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
			case '--virtual': VIRTUAL = parts[1]; break;
			default: throw 'Invalid option ' + parts[0];
		}
	}
})();

function buildProxy() {
	var proxy = new Proxy(PORT);
	proxy.setHandler('localhost', localhost.buildHandler());

	switch(MODE) {
		case 'pass':
			proxy.setHandler('proxy', require('../lib/modes/pass').buildHandler());
			break;
		case 'capture':
			proxy.setHandler('proxy', require('../lib/modes/capture').buildHandler(MEMENTO));
			break;
		case 'replay':
			proxy.setHandler('proxy', require('../lib/modes/replay').buildHandler(MEMENTO));
			break;
		default: throw 'Invalid proxy mode';
	}

	if(VIRTUAL) {
		var scraper = require('../lib/virtual/plugin');
		scraper.setupProxy(proxy, VIRTUAL);
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
	PROXY.close(function() {
		if(MODE == 'capture') {
			MEMENTO.saveTo(SOURCE, process.exit.bind(process));
		} else {
			process.exit();
		}
	});
}

process.on('SIGTERM', finishGracefully);
process.on('SIGINT', finishGracefully);
