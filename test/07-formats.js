var path   = require ('path');
var fs     = require ('fs');
var assert = require ('assert');

var confFu     = require ('../index');
var confFuPath = require.resolve('../index');

var baseName = path.basename (__filename, path.extname (__filename));
var configDir = path.join (__dirname, baseName);

var globalVerbose = process.env.VERBOSE || false;

var io = require ('../io');

describe (baseName+" check formats", function () {

	var iniData;

	it ("can read ini", function (done) {
		var fileIO = new io (path.join (__dirname, baseName, 'test.ini'));

		assert (typeof fileIO.parseBuffer === 'function');
		assert (typeof fileIO.stringify === 'function');
		// assert (typeof fileIO.detectedFormat === 'ini');

		fileIO.readAndParseFile (function (err, data, parsed) {

			assert (!err);

			iniData = parsed.object;

			assert (parsed.object.aaa.bbb === 'ccc');
			assert (parsed.object.xxx.yyy === 'zzz');

			done ();
		});

	});

	it ("can write ini", function (done) {
		var fileIO = new io (path.join (__dirname, baseName, 'test.ini'));

		fileIO.serializeToFile (iniData, function (err) {

			assert (!err);
			done ();
		});

	});

	it ("can read ini again", function (done) {
		var fileIO = new io (path.join (__dirname, baseName, 'test.ini'));

		fileIO.readAndParseFile (function (err, data, parsed) {

			assert (!err);

			assert.deepEqual (iniData, parsed.object);

			assert (parsed.object.aaa.bbb === 'ccc');
			assert (parsed.object.xxx.yyy === 'zzz');

			done ();
		});

	});

	var ymlData;

	it ("wrong yml", function (done) {
		var fileIO = new io (path.join (__dirname, baseName, 'wrong.yml'));

		assert (typeof fileIO.parseBuffer === 'function');
		assert (typeof fileIO.stringify === 'function');
		// assert (typeof fileIO.detectedFormat === 'ini');

		fileIO.readAndParseFile (function (err, data, parsed) {

			assert (err);
			done ();
		});

	});

	it ("can use yml", function (done) {
		var fileIO = new io (path.join (__dirname, baseName, 'test.yml'));

		assert (typeof fileIO.parseBuffer === 'function');
		assert (typeof fileIO.stringify === 'function');
		// assert (typeof fileIO.detectedFormat === 'ini');

		fileIO.readAndParseFile (function (err, data, parsed) {

			assert (!err);

			ymlData = parsed.object;

			// console.log (parsed.object);

			assert (parsed.object.aaa.bbb.length === 3);
			assert (parsed.object.aaa.bbb[2] === 'c');
			assert (parsed.object.xxx.yyy === 'zzz');

			done ();
		});

	})

	it ("can write yml", function (done) {
		var fileIO = new io (path.join (__dirname, baseName, 'test.yml'));

		fileIO.serializeToFile (ymlData, function (err) {

			assert (!err);
			done ();
		});

	});

	it ("can read yml again", function (done) {
		var fileIO = new io (path.join (__dirname, baseName, 'test.yml'));

		fileIO.readAndParseFile (function (err, data, parsed) {

			assert (!err);

			assert.deepEqual (ymlData, parsed.object);

			assert (parsed.object.aaa.bbb.length === 3);
			assert (parsed.object.aaa.bbb[2] === 'c');
			assert (parsed.object.xxx.yyy === 'zzz');


			done ();
		});

	});
});
