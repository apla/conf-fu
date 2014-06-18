"use strict";

var ConfFu = function (options) {
	if (!options) {
		throw "no config file defined, please supply options and fixupFile or settings object";
	}
};

ConfFu.prototype.formats = require ('./formats');

module.exports = ConfFu;
