var path   = require ('path');
var fs     = require ('fs');
var assert = require ('assert');

var confFu     = require ('../index');
var confFuPath = require.resolve('../index');

var baseName = path.basename (__filename, path.extname (__filename));
var configDir = path.join (__dirname, baseName);

var globalVerbose = process.env.VERBOSE || false;

describe (baseName+" loading config", function () {

	afterEach (function(done) {
		// TODO: unlink not-found.json
		fs.unlink (path.join (configDir, 'not-found.json'), function () {
			done ();
		});
	});

	it ("and good fixup should return config", function (done) {
		var config = new confFu ({
			configFile: path.join (configDir, 'index.json'),
			fixupFile:  path.join (configDir, 'fixup.json')
		});

		config.verbose = globalVerbose || false;

		config.on ('ready', function () {
			assert (!config.fixupChanged); // fixup must be leaved intact
			done();
		});
		config.on ('error', function (eOrigin, eType, eData, eFile) {
			assert (false, 'wrong config');
		});
//		assert (Object.keys (config).length > 0, 'with keys');
	});

	it ("and bad fixup should not return config", function (done) {
		var config = new confFu ({
			configFile: path.join (configDir, 'index.json'),
			fixupFile:  path.join (configDir, 'wrong-format.json')
		});

		config.verbose = globalVerbose || false;

		config.on ('ready', function () {
			assert (false, 'parse error for any config file is fatal error');
		});
		config.on ('error', function (eOrigin, eType, eData, eFile) {
			if (eOrigin === 'fixup' && eType === 'parse') {
				done();
			} else {
				assert (false, 'just got unexpected error');
			}

		});
//		assert (Object.keys (config).length > 0, 'with keys');
	});

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

		var pass = false;

		config.on ('error', function (eOrigin, eType, eData, eFile) {
			if (eType === 'variables') {
				pass = true;
			} else if (eType === 'file' && eOrigin === 'fixup') {
				// that's ok, because we create fixup in case of his abscence
			} else {
				assert (false, 'just got unexpected error');
				done ();
			}
		});

		config.on ('notReady', function () {
			if (!pass) assert (false);
			assert (config.fixupChanged); // fixup must be written
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
			throw "unexpected ready";
			assert (false);
		});

		var pass = false;

		config.on ('error', function (eOrigin, eType, eData, eFile) {
			if (eType === 'variables') {
				pass = true;
				return;
			} else if (eType === 'file' && eOrigin === 'fixup') {
				// config fixup not found
				return;
			}
			throw "unexpected error";
		});

		config.on ('notReady', function () {
			if (!pass) assert (false);
			assert (config.fixupChanged); // fixup must be written
			done ();
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
			assert (!config.fixupChanged); // fixup must be leaved intact
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
			assert (false);
		});

		config.on ('ready', function () {
			assert (!config.fixupChanged); // fixup must be leaved intact
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
			assert (false);
		});

		config.on ('ready', function () {
			assert (!config.fixupChanged); // fixup must be leaved intact
			//			console.log (JSON.stringify (config.config));
			// WHY???
			assert ("zzz" in config.config.database.include.root, "has 'zzz' in 'root'");

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
			assert (config.fixupChanged); // fixup must be written
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


});
