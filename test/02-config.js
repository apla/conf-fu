var path   = require ('path');
var fs     = require ('fs');
var assert = require ('assert');

var confFu     = require ('../index');
var confFuPath = require.resolve('../index');

var assets = path.basename (__filename, path.extname (__filename));
var configDir = path.join (__dirname, assets);

var globalVerbose = process.env.VERBOSE || false;

describe ("loading config", function () {
	
	beforeEach (function(done) {
		// TODO: unlink not-found.json
		fs.unlink (path.join (configDir, 'not-found.json'), function () {
			done ();
		});
	});
	
	it ("and good fixup should return config", function (done) {
		var config = new confFu (path.join (configDir, 'index.json'), path.join (configDir, 'fixup.json'));
		
		config.verbose = globalVerbose || false;
		
		config.on ('ready', function () {
			done();
		});
		config.on ('error', function (eOrigin, eType, eData, eFile) {
			assert (false, 'wrong config');
		});
//		assert (Object.keys (config).length > 0, 'with keys');
	});
	
	it ("and bad fixup should not return config", function (done) {
		var config = new confFu (path.join (configDir, 'index.json'), path.join (configDir, 'wrong-format.json'));
		
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
		var config = new confFu (path.join (configDir, 'index.json'), path.join (configDir, 'not-found.json'));
		
		config.verbose = globalVerbose || false;
		
		config.on ('ready', function () {
			assert (false, 'parse error for any config file is fatal error');
			done ();
		});
		config.on ('error', function (eOrigin, eType, eData, eFile) {
			if (eType === 'variables') {
				fs.stat (path.join (configDir, 'not-found.json'), function (err, stats) {
					done (err);
				});
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
		var config = new confFu (path.join (configDir, 'include.json'), path.join (configDir, 'not-found.json'));
		
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
		var config = new confFu (path.join (configDir, 'include.json'), path.join (configDir, 'include-fixup.json'));
		
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
		var config = new confFu (path.join (configDir, 'index.ini'), path.join (configDir, 'ini-fixup.json'));
		
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

	it.skip ('with falsy variables', function (done) {});
	
	it ('with optional placeholders and defaults', function (done) {
		var config = new confFu (path.join (configDir, 'placeholders.json'));
		
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
			config: path.join (configDir, 'include.json'),
			fixup: path.join (configDir, 'include-fixup.json')
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
			config: path.join (configDir, 'include.json'),
			fixup: path.join (configDir, '<$instance>-fixup.json'),
			instance: 'include'
		});

		config.on ('ready', function () {
			done ();
		});
});
	
	it.skip ('expansion in external files', function (done) {});
	
	it.skip ("with extra keys in fixup should return config, but emit error", function (done) {
	});

	
});