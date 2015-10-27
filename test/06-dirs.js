var path   = require ('path');
var fs     = require ('fs');
var assert = require ('assert');

var confFu     = require ('../index');
var confFuPath = require.resolve('../index');

var baseName = path.basename (__filename, path.extname (__filename));
var configDir = path.join (__dirname, baseName);

var globalVerbose = process.env.VERBOSE || false;

describe (baseName+" loading config with dirs", function () {

	it ("assume 'configFile' and 'fixupFile' within 'configDir'", function (done) {
		var config = new confFu ({
			configFile: 'index.json',
			configRoot: 'test/02-config',
			fixupFile:  'fixup.json'
		});

		config.verbose = globalVerbose || false;

		config.on ('ready', function () {
			done();
		});
		config.on ('error', function (eOrigin, eType, eData, eFile) {
			assert (false, 'wrong config');
		});
		//		assert (Object.keys (config).length > 0, 'with keys');
	});

	it ("assume 'configFile' and 'fixupFile' within 'configDir' within 'projectRoot'", function (done) {
		var config = new confFu ({
			configFile: 'index.json',
			configRoot: '02-config',
			projectRoot: 'test',
			fixupFile:  'fixup.json'
		});

		config.verbose = globalVerbose || false;

		config.on ('ready', function () {
			done();
		});
		config.on ('error', function (eOrigin, eType, eData, eFile) {
			console.log (config);
			assert (false, ['wrong config', eOrigin, eType, eData, eFile].join (" "));
		});
	});

	it ("should find 'configName' and 'fixupName' with one of the supported extensions within 'configDir'", function (done) {
		var config = new confFu ({
			configName: 'include',
			configRoot: '02-config',
			projectRoot: 'test',
			fixupName:  'include-fixup'
		});

		config.verbose = globalVerbose || false;

		config.on ('ready', function () {
			done();
		});
		config.on ('error', function (eOrigin, eType, eData, eFile) {
			assert (false, 'wrong config');
		});
	});

	it ("should find 'configName' and 'fixupName' with one of the supported extensions within 'configDir' with instance", function (done) {
		var config = new confFu ({
			configName: 'include',
			configRoot: '02-config',
			projectRoot: 'test',
			instanceFile: "instance",
			fixupName:  '<$instance>-fixup'
		});

		config.verbose = globalVerbose || false;

		config.on ('ready', function () {
			done();
		});
		config.on ('error', function (eOrigin, eType, eData, eFile) {
			assert (false, 'wrong config');
		});
	});

	it ("should find 'configName' and 'fixupName' with one of the supported extensions within 'configDir' with instance 2", function (done) {
		var config = new confFu ({
			configName: 'include',
			configRoot: '02-config',
			projectRoot: 'test',
			instanceFile: "instance-xxx",
			fixupName:  '<$instance>/override'
		});

		config.verbose = globalVerbose || false;

		config.on ('ready', function () {
			done();
		});
		config.on ('error', function (eOrigin, eType, eData, eFile) {
			console.log (config.configFile, config.fixupFile);
			assert (false, 'wrong config');
		});
	});

	it ("must emit proper message if can't find config file by name", function (done) {
		var config = new confFu ({
			configName: 'aaa',
			configRoot: '02-config',
			projectRoot: 'test',
			instanceFile: "instance-xxx",
			fixupName:  '<$instance>/override'
		});

		config.verbose = globalVerbose || false;

		config.on ('notReady', function () {
			done();
		});
		config.on ('error', function (eOrigin, eType, eData, eFile) {
			// console.log (config.configFile, config.fixupFile);
			// assert (false, 'wrong config');
		});
	});


	/*
	it ("and no fixup should return variables", function (done) {
		var config = new confFu ({
			configFile: path.join (configDir, 'index.json'),
			fixupFile:  path.join (configDir, 'not-found.json')
		});

		config.verbose = globalVerbose || false;

		config.on ('ready', function () {
			assert (false, 'config not populated');
			done ();
		});
		config.on ('error', function (eOrigin, eType, eData, eFile) {
			if (eType === 'variables') {
				setTimeout (function () {
					fs.stat (path.join (configDir, 'not-found.json'), function (err, stats) {
						if (!err) {
							// this file must be created
							done ();
							return;
						}
						assert (false, 'filesystem not fast enough to create this file, we must wrap around this case');
					});
				}, 100);
			} else if (eType === 'file' && eOrigin === 'fixup') {
				// that's ok, because we create fixup in case of his abscence
			} else {
				assert (false, 'just got unexpected error');
				done ();
			}
		});
		//		assert (Object.keys (config).length > 0, 'with keys');
	});

	it ("with includes and no fixup should return variables", function (done) {
		var config = new confFu ({
			configFile: path.join (configDir, 'include.json'),
			fixupFile:  path.join (configDir, 'not-found.json')
		});

		config.verbose = globalVerbose || false;

		config.on ('ready', function () {
			console.error ("unexpected ready");
		});

		config.on ('error', function (eOrigin, eType, eData, eFile) {
			if (eType === 'variables') {
				done();
				return;
			} else if (eType === 'file' && eOrigin === 'fixup') {
				// config fixup not found
				return;
			}
			console.error ("unexpected error", arguments);
		});
	});


	var configWIncludes;

	it ("with includes and fixup should return config", function (done) {
		var config = new confFu ({
			configFile: path.join (configDir, 'include.json'),
			fixupFile:  path.join (configDir, 'include-fixup.json')
		});

		config.verbose = globalVerbose || false;

		config.on ('error', function () {
			console.log (arguments);
		});

		config.on ('ready', function () {

			//			console.log (JSON.stringify (config.config));
			assert ("xxx" in config.config.root, "has 'xxx' in 'root'");

			configWIncludes = config.config;

			done ();
		});
	});

	var iniTest = it.skip;
	try {
		var ini = require ('ini');
		iniTest = it;
	} catch (e) {

	}

	iniTest ("ini with json includes and fixup should return config", function (done) {
		var config = new confFu ({
			configFile: path.join (configDir, 'index.ini'),
			fixupFile:  path.join (configDir, 'ini-fixup.json')
		});

		config.verbose = globalVerbose || false;

		config.on ('error', function () {
			console.log (arguments);
		});

		config.on ('ready', function () {

			//			console.log (JSON.stringify (config.config));
			assert ("zzz" in config.config.database.include.root, "has 'zzz' in 'root'");

			//			console.trace ();

			done ();
		});
	});

	iniTest ("ini with json includes and ini fixup should return config", function (done) {
		var config = new confFu ({
			configFile: path.join (configDir, 'index.ini'),
			fixupFile:  path.join (configDir, 'ini-fixup.ini')
		});

		config.verbose = globalVerbose || false;

		config.on ('error', function () {
			console.log (arguments);
		});

		config.on ('ready', function () {

			//			console.log (JSON.stringify (config.config));
			// WHY???
			// assert ("zzz" in config.config.database.include.root, "has 'zzz' in 'root'");

			//			console.trace ();

			done ();
		});
	});

	var ymlTest = it.skip;
	try {
		var yml = require ('js-yaml');
		ymlTest = it;
	} catch (e) {

	}


	ymlTest ("yml with json includes and yml fixup should return config", function (done) {
		var config = new confFu ({
			configFile: path.join (configDir, 'index.yml'),
			fixupFile:  path.join (configDir, 'fixup.yml')
		});

		config.verbose = globalVerbose || false;

		config.on ('error', function () {
			console.log (arguments);
		});

		config.on ('ready', function () {

			//			console.log (JSON.stringify (config.config));
			// WHY???
			// assert ("zzz" in config.config.database.include.root, "has 'zzz' in 'root'");

			//			console.trace ();

			done ();
		});
	});


	it.skip ('with falsy variables', function (done) {});

	it ('with optional placeholders and defaults', function (done) {
		var config = new confFu ({
			configFile: path.join (configDir, 'placeholders.json')
		});

		config.verbose = globalVerbose || false;

		config.on ('error', function () {
			console.log (arguments);
		});

		config.on ('ready', function () {

			assert ("default-val" in config.config, "has default key");
			assert (config.config["default-val"] === "12345", "has default key");
			assert ("optional-val" in config.config, "has optional key");
			assert (config.config["optional-val"] === null, "has optional key");
			//			console.log (JSON.stringify (config.config));
			//			assert ("zzz" in config.config.database.include.root, "has 'zzz' in 'root'");

			done ();
		});
	});

	it ('with params dictionary', function (done) {
		var config = new confFu ({
			configFile: path.join (configDir, 'include.json'),
			fixupFile:  path.join (configDir, 'include-fixup.json')
		});

		config.verbose = globalVerbose || false;

		config.on ('error', function () {
			console.log (arguments);
		});

		config.on ('ready', function () {

			//			console.log (JSON.stringify (config.config));
			assert ("xxx" in config.config.root, "has 'xxx' in 'root'");

			configWIncludes = config.config;

			done ();
		});

	});

	it ('with instance in fixup name', function (done) {
		var config = new confFu ({
			configFile: path.join (configDir, 'include.json'),
			fixupFile:  path.join (configDir, '<$instance>-fixup.json'),
			instance: 'include'
		});

		config.on ('ready', function () {
			done ();
		});
	});

	it ('with instance in fixup name and instance file', function (done) {
		var config = new confFu ({
			configFile: path.join (configDir, 'include.json'),
			fixupFile:  path.join (configDir, '<$instance>-fixup.json'),
			instanceFile: path.join (configDir, 'instance')
		});

		config.on ('error', function () {
			console.log (arguments);
		});

		config.on ('ready', function () {
			done ();
		});
	});


	it.skip ('expansion in external files', function (done) {});

	it.skip ("with extra keys in fixup should return config, but emit error", function (done) {
	});

	*/

});
