var path   = require ('path');
var fs     = require ('fs');
var assert = require ('assert');

var confFu     = require ('../base');
var confFuPath = require.resolve('../base');

// TODO: use script name
var baseName = path.basename (__filename, path.extname (__filename));
var configDir = path.join (__dirname, baseName);

var globalVerbose = process.env.VERBOSE || false;

describe (baseName+" launch base.js with populated config and fixup objects", function () {

	it ("should return config", function () {
		var config = new confFu ({
			config: {a: {b: {c: "<#abc>"}}},
			fixup: {a: {b: {c: false}}}
		});

		config.verbose = globalVerbose || false;

		assert (config.ready, 'config ready');
		assert (config.config.a.b.c === false, 'fixup applied');
	});
});

describe (baseName+" launch base.js with config", function () {

	it ("should return config", function () {
		var config = new confFu ({
			config: {a: {b: {c: false}}}
		});

		config.verbose = globalVerbose || false;

		assert (config.ready, 'config ready');
		assert (config.config.a.b.c === false, 'falsy value');
	});

	it ("with variables should return variables", function () {
		var config = new confFu ({
			config: {
				a: {b: {c: "<$x>"}},
				x: true
			}
		});

		config.verbose = globalVerbose || false;

		assert (config.ready, 'config ready');
		assert (config.config.a.b.c === true, 'variable interpolated');
		assert (config.variables["a.b.c"][0] === "<$x>", 'variable interpolated');
		assert (config.variables["a.b.c"][1] === true, 'variable interpolated');


	});

	it ("with placeholders should return variables", function () {
		var config = new confFu ({
			config: {a: {b: {c: "<#who knows>"}}, x: true}
		});

		config.verbose = globalVerbose || false;

//		console.log (config);

		assert (!config.ready, 'config ready');
		assert (config.variables["a.b.c"][0] === "<#who knows>", 'placeholder');
	});

});

