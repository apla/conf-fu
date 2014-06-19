#!/usr/bin/env node

var path    = require ('path');
var options = require ('minimist')(process.argv.slice(2));

var MODULE_NAME = 'conf-fu';
var confFu      = require (MODULE_NAME);
var cli         = require (MODULE_NAME + '/cli.js');

var paint = confFu.paint;

if (!options.configFile)
	options.configFile = process.env.CONF_FU;

if (!options.configFile) {
	console.log (
		paint.confFu (),
		"please define core config file using CONF_FU environment variable or --config command line option"
	);
}

if (!options.fixupFile)
	options.fixupFile = process.env.CONF_FU_FIXUP;

if (!options.instance)
	options.instance = process.env.CONF_FU_INSTANCE || process.env.INSTANCE;

var conf = new confFu (options);

conf.verbose = true;

conf.on ('ready', cli.onConfigReady.bind (conf, options));

conf.on ('error', cli.onConfigError.bind (conf, options));

