#!/usr/bin/env node
var fs = require ('fs');

var files = ['operations', 'types', 'formats'];
var wrapper = ['(function(mod) {\n  if (typeof exports == "object" && typeof module == "object") // CommonJS\n	module.exports = mod();\n  else if (typeof define == "function" && define.amd) // AMD\n	return define([], mod);\n  else // Plain browser env\n	this.ConfFu = mod();\n})(function() {\n',
'});'];


var clientStream = fs.createWriteStream ('client.js');

clientStream.write (wrapper[0]);

var data = {};

var baseData = fs.readFileSync ('base.js').toString();

files.forEach (function (fileName) {
	var fData = fs.readFileSync (fileName + '.js').toString();

	var cleanData = fData.replace (/module\.exports = /, "");

	var rx = new RegExp ("require\\s*\\(\\s*[\'\"]\\.\\/" + fileName + "[\'\"]\\s*\\)", "gm");

	// console.log (baseData.match (rx));

	baseData = baseData.replace (rx, cleanData.trim());
})

clientStream.write (baseData);

clientStream.write (wrapper[1]);
