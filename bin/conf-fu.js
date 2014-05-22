#!/usr/bin/env node

var MODULE_NAME = 'conf-fu';

var path   = require ('path');
var confFu = require (MODULE_NAME);

var minimist = require ('minimist');

//var conf = new confFu ({
//	verbose: true,
//	configFile: 'test/00-config/index.json',
//	configFixupFile: 'test/00-config/fixup.json'
//});

var conf = new confFu ('test/00-config/index.json', 'test/00-config/not-found.json');
//var conf = new confFu ('test/00-config/index.json', 'test/00-config/empty.json');


conf.verbose = true;

conf.on ('ready', function () {

});

conf.on ('error', function () {

});

// 


function launchScript (conf, err) {
	var scriptName = process.argv[2];

	if (!scriptName)
		scriptName = "help";


	if (err) {
		if (err === "no project config" && !scriptName.match (/^(help|init)$/)) {
			console.error (
				'no', log.dataflows(),
				'project config found. please run',
				log.path ('dataflows help'), 'or', log.path ('dataflows init')
			);
		}
		if (conf && scriptName !== "config") {
			conf = null;
		}
	}

	var scriptClass;
	try {
		scriptClass = require (project.root.fileIO ('bin', scriptName).path);
	} catch (e) {
		try {
			// console.log (path.join (MODULE_NAME, 'script', scriptName));
			scriptClass = require (path.join (MODULE_NAME, 'bin', scriptName));
		} catch (e) {
			console.error (e);
		}
	}

	if (!scriptClass) {
		// TODO: list all available scripts with descriptions
		console.error('sorry, there is no such script "%s"', scriptName);
		process.exit();
	}

	var scriptMethod = 'launch';
	var launchContext;

	if (typeof scriptClass.launchContext === 'function') {
		launchContext = scriptClass.launchContext() || {};
		if (launchContext.method) {
			scriptMethod = launchContext.method;
		}
	}

	scriptClass.command = launchContext.command || process.argv[2];
	scriptClass.args    = launchContext.args || minimist(process.argv.slice(3));

	// scriptClass.args =

	if (!err && typeof scriptClass[scriptMethod] === 'function') {
		scriptClass[scriptMethod](conf, project);
	} else if (typeof scriptClass[scriptMethod + 'Anyway'] === 'function') {
		scriptClass[scriptMethod + 'Anyway'](conf, project);
	} else {
		console.error(
			'missing method "%s" for script "%s"',
			scriptMethod, scriptName
		);
		process.exit();
	}

}
