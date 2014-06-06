#!/usr/bin/env node

var MODULE_NAME = 'conf-fu';

var path   = require ('path');
var confFu = require (MODULE_NAME + '/cli.js');

var options = require ('minimist')(process.argv.slice(2));

var paint = confFu.paint;

if (!options.config)
	options.config = process.env.CONF_FU;

if (!options.config) {
	console.log (
		paint.confFu (),
		"please define core config file using CONF_FU environment variable or --config command line option"
	);
}

if (!options.fixup)
	options.fixup = process.env.CONF_FU_FIXUP;

if (!options.instance)
	options.instance = process.env.CONF_FU_INSTANCE || process.env.INSTANCE;

var conf = new confFu (options);

conf.cli (options);
