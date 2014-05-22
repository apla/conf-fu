var path   = require ('path');
var fs     = require ('fs');
var assert = require ('assert');


var confFu     = require ('../index');
var confFuPath = require.resolve('../index');

// TODO: use script name
var configDir = path.join (__dirname, '00-config');

var globalVerbose = process.env.VERBOSE || false;

describe ("tech debt", function () {
	var confFuContents = fs.readFileSync (confFuPath);
	var todos = confFuContents.toString().match (/TODO[^\n\r]+|WTF[^\n\r]+/g);
	if (todos) {
		todos.forEach (function (todoText) {
			it.skip (todoText);
//			console.log (todoText);
		})
	}

});

describe ("loading config", function () {
	
	before (function(done) {
		// TODO: unlink not-found.json
		fs.unlink (path.join (configDir, 'not-found.json'), function () {
			done ();
		});
	});
	
	it ("using config and good fixup should return config", function (done) {
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
	
	it ("using config and bad fixup should not return config", function (done) {
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

	it ("using config and no fixup should return variables and create fixup", function (done) {
		var config = new confFu (path.join (configDir, 'index.json'), path.join (configDir, 'not-found.json'));
		
		config.verbose = globalVerbose || false;
		
		config.on ('ready', function () {
			assert (false, 'parse error for any config file is fatal error');
			done ();
		});
		config.on ('error', function (eOrigin, eType, eData, eFile) {
			if (eType === 'variables') {
				done();
			} else if (eType === 'file' && eOrigin === 'fixup') {
				// that's ok, because we create fixup in case of his abscence
			} else {
				assert (false, 'just got unexpected error');
				done ();
			}
			
		});
//		assert (Object.keys (config).length > 0, 'with keys');
	});
});  