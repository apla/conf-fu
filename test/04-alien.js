var path   = require ('path');
var fs     = require ('fs');
var assert = require ('assert');

var confFu     = require ('../index');
var confFuPath = require.resolve('../index');

var io = require ('../io');

var baseName = path.basename (__filename, path.extname (__filename));
var configDir = path.join (__dirname, baseName);

var globalVerbose = process.env.VERBOSE || false;

//var regexp0 = /<(([\$\#]*)((optional|default):)*([^>]+))>/;
//console.log ("<$optional:db.mongo.port>".match (regexp0));
//console.log ("<filename>".match (regexp0));
//var regexp1 = /<((\$)((int|quoted|bool):)?([^>]+))>/i;
//var regexp2 = /<((\#)((optional|default):)?([^>]+))>/i;
//var regexp3 = /^<<([^<>]+)>>$/i;
//console.log ("<$int:db.mongo.port>".match (regexp1));
//console.log ("<#default:12345>".match (regexp2));
//console.log ("<<filename>>".match (regexp3));


describe (baseName+" interpolate vars in external file", function () {

	beforeEach (function (done) {
		fs.unlink (path.join (configDir, 'fixup-none.json'), function () {done()});
	});

	it ("with include enchantment", function (done) {
		var config = new confFu ({
			configFile: path.join (configDir, 'index.json'),
			fixupFile: path.join (configDir, 'fixup.json'),
			alienFiles: [{
				tmpl: path.join (configDir, 'httpd-alt.conf.conf-fu'),
				file: path.join (configDir, 'httpd-alt.conf')
			}, {
				tmpl: path.join (configDir, 'nothing-to-interpolate.txt'),
				file: path.join (configDir, 'nothing-to-interpolate')
//			}, {
//				tmpl: path.join (configDir, "aaa"),
//				file: path.join (configDir, "bbb")
			}]
		});

		config.verbose = globalVerbose || false;

		config.on ('ready', function () {

			try {
				fs.statSync (path.join (configDir, 'nothing-to-interpolate'));
			} catch (e) {
				config.interpolateAlien (
					path.join (configDir, 'httpd.conf.conf-fu'),
					true,
					done
				);
				return;
			}

			assert (false);

		});

		config.on ('error', function (eOrigin, eType, eData, eFile) {
			console.log (arguments);
			assert (false, ['wrong config', eOrigin, eType, eData, eFile].join (" "));
		});

		config.on ('notReady', function () {
			assert (false);
		})

	});

	it ("with include enchantment and fsobject", function (done) {
		var config = new confFu ({
			configFile: path.join (configDir, 'index.json'),
			fixupFile: path.join (configDir, 'fixup.json'),
			alienFiles: [{
				tmpl: new io (path.join (configDir, 'httpd-alt.conf.conf-fu')),
				file: path.join (configDir, 'httpd-alt.conf')
			}]
		});

		config.verbose = globalVerbose || false;

		config.on ('ready', function () {

			try {
				fs.statSync (path.join (configDir, 'nothing-to-interpolate'));
			} catch (e) {
				config.interpolateAlien (
					path.join (configDir, 'httpd.conf.conf-fu'),
					true,
					done
				);
				return;
			}

			assert (false);

		});

		config.on ('error', function (eOrigin, eType, eData, eFile) {
			console.log (arguments);
			assert (false, ['wrong config', eOrigin, eType, eData, eFile].join (" "));
		});

		config.on ('notReady', function () {
			assert (false);
		})

	});

	it ("fine with missing alien file", function (done) {
		var config = new confFu ({
			configFile: path.join (configDir, 'index.json'),
			fixupFile: path.join (configDir, 'fixup-bad.json'),
			alienFiles: [{
				tmpl: path.join (configDir, 'httpd-bad.conf.conf-fu')
			}]
		});

		config.verbose = globalVerbose || false;

		var alienErrors = 0;

		config.on ('ready', function () {
			assert (false);
		});

		config.on ('error', function (eOrigin, eType, eData, eFile) {
			if ((eOrigin === 'alien' || eOrigin === 'config') && eType === 'variables') {
				alienErrors++;
				return;
			}
			console.log (arguments);
			assert (false, ['wrong config', eOrigin, eType, eData, eFile].join (" "));
		});

		config.on ('notReady', function () {
			if (alienErrors !== 1) assert (false, "everything is fine but alien file is absent");
			done ();
		})

	});

	it ("search for a file and fixup", function (done) {
		var config = new confFu ({
			configRoot: configDir,
			configName: 'index',
			fixupName:  'fixup'
		});

		config.verbose = true;

		config.on ('ready', function () {
			assert (!config.fixupChanged); // fixup must be leaved intact
			done();
		});
		config.on ('error', function (eOrigin, eType, eData, eFile) {
			assert (false, 'wrong config');
		});
		//		assert (Object.keys (config).length > 0, 'with keys');
	});

	it ("search for a file and fixup-none", function (done) {
		var config = new confFu ({
			configRoot: configDir,
			configName: 'index',
			instanceFile: 'instance',
			fixupName:  'fixup-none'
		});

		config.verbose = true;

		var instanceErrors = 0;

		config.on ('ready', function () {
			done()
		});

		config.on ('error', function (eOrigin, eType, eData, eFile) {
			if (eOrigin === 'instance' && eType === 'file') {
				instanceErrors ++;
				return;
			} else if (eOrigin === 'fixup' && eType === 'file') {
				instanceErrors ++;
				return;
			}
			console.log ('!!!!!!!', eOrigin, eType, eData, eFile);
			assert (false, 'wrong config');
		});

		config.on ('notReady', function () {
			assert (instanceErrors !== 1)
			done()
		});

	});

	it ("search for a file and fixup name interpolated", function (done) {
		var config = new confFu ({
			configRoot: configDir,
			configName: 'index',
			instanceFile: 'instance',
			fixupName:  'fixup-<$instance>'
		});

		config.verbose = true;

		var instanceErrors = 0;

		config.on ('ready', function () {
			done()
		});

		config.on ('error', function (eOrigin, eType, eData, eFile) {
			if (eOrigin === 'instance' && eType === 'file') {
				instanceErrors ++;
				return;
			} else if (eOrigin === 'fixup' && eType === 'file') {
				instanceErrors ++;
				return;
			}
			console.log ('!!!!!!!', eOrigin, eType, eData, eFile);
			assert (false, 'wrong config');
		});

		config.on ('notReady', function () {
			assert (instanceErrors !== 1)
			done()
		});

	});


});

//		if ("placeholder" in enchanted) {
//			if (enchanted.optional) {
//			} else if (enchanted.default) {
//			}
//		} else if ("variable" in enchanted) {
//		} else if ("error" in enchanted || "include" in enchanted) {
//
//		}
