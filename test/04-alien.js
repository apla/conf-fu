var path   = require ('path');
var fs     = require ('fs');
var assert = require ('assert');

var confFu     = require ('../index');
var confFuPath = require.resolve('../index');

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

	it ("with include enchantment", function (done) {
		var config = new confFu ({
			configFile: path.join (configDir, 'index.json'),
			fixupFile: path.join (configDir, 'fixup.json'),
			alienFiles: [{
				tmpl: path.join (configDir, 'httpd.conf.conf-fu'),
				file: path.join (configDir, 'httpd.conf')
			}]
		});

		config.verbose = globalVerbose || false;

		config.on ('ready', function () {
			config.interpolateAlien (
				path.join (configDir, 'httpd.conf.conf-fu'),
				true,
				done
			);
		});
		config.on ('error', function (eOrigin, eType, eData, eFile) {
			console.log (arguments);
			assert (false, ['wrong config', eOrigin, eType, eData, eFile].join (" "));
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
