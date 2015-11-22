"use strict";

var path     = require ('path');
var fsObject = require ('fsobject');
var formats  = require ('./formats');

/**

 * io Description

 * @returns {type} Description

 */

function io () {
	https://github.com/petkaantonov/bluebird/wiki/Optimization-killers#32-leaking-arguments
	var $_len = arguments.length;var args = new Array($_len); for(var $_i = 0; $_i < $_len; ++$_i) {args[$_i] = arguments[$_i];}
	fsObject.apply (this, args);
	this.appendFormat();
}

io.prototype = Object.create(fsObject.prototype);

io.prototype.appendFormat = function () {
	if (this.extension in formats) {
		var format = formats[this.extension];
		this.parseBuffer    = format.parse;
		this.stringify      = format.stringify;
		this.detectedFormat = format.type;
		return true;
	}
}


/**

 * readAndParseFile reads and then parse file contents based on file extension

 * @param {type} cb callback for result. receives 2 params: `err` and `data`.
 if err have errno, then it is file error, otherwise — parsing.
 if filename have no extension of parser for file contents is undefined, then parser error generated.
s
 */

io.prototype.readAndParseFile = function (cb) {

	var self = this;
	this.readFile (function (err, data) {
		if (err) {
			cb (err);
			return;
		}

		var parsedObject = self.parseBuffer (data);
		cb (null, data, parsedObject);
	});
}

module.exports = io;
