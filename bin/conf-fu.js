#!/usr/bin/env node

var MODULE_NAME = 'conf-fu';
var confFu      = require (MODULE_NAME + '/cli.js');

var paint = confFu.paint;

var conf = new confFu (options);

conf.verbose = true;
