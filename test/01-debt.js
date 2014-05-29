var path   = require ('path');
var fs     = require ('fs');
var assert = require ('assert');

var confFu     = require ('../index');
var confFuPath = require.resolve('../index');

var globalVerbose = process.env.VERBOSE || false;

describe ("tech debt", function () {
	var confFuContents = fs.readFileSync (confFuPath);
	var todos = confFuContents.toString().match (/TODO[^\n\r]+|WTF[^\n\r]+/g);
	if (todos) {
		todos.forEach (function (todoText) {
			it.skip (todoText);
//			console.log (todoText);
		});
	}

});
