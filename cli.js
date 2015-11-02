

function onConfigReady (options) {
	var haveCommand = findCommand (options) || '_';

	cli[haveCommand].run.apply (this, arguments);
}

function onConfigFail (options) {
	var haveCommand = findCommand (options) || '_';

	if (cli[haveCommand].anyway)
		cli[haveCommand].run.apply (this, arguments);
}

function onConfigError (options, eOrigin, eType, eData, eFile) {
	// origin can be config, fixup or include
	// type can be file, parser, variables

	var logger = console.error.bind (console);

	if (eType === 'parse') {
		console.log (paint.confFu (), eOrigin, 'file', eType, paint.error ('cli cannot continue, terminating process'));
		process.kill ();
	} else if (eType === 'file') {
		if (eOrigin !== 'fixup' && eOrigin !== 'alien') {
			console.log (paint.confFu (), eOrigin, 'file', eType, paint.error ('cli cannot continue, terminating process'));
			process.kill ();
		}
	} else if (eType === 'variables') {
	}
}



var spawn = require('child_process').spawn;

function ConfFuCLI (options) {

	if (!options)
		options = ConfFuCLI.initOptions ();

	var haveCommand = findCommand (options);

	if (!options.configFile) {
		console.log (
			paint.confFu (),
			"please define core config file using CONF_FU environment variable or --config-file command line option"
		);
	}


	if (haveCommand && cli[haveCommand].before) {
		cli[haveCommand].run.apply (this, arguments);
		if (options.dryRun)
			return;
	}

	var conf = new ConfFu (options);

	conf.on ('ready', onConfigReady.bind (conf, options));
	conf.on ('notReady', onConfigFail.bind (conf, options));
	conf.on ('error', onConfigError.bind (conf, options));

	return conf;
}

ConfFuCLI.initOptions = initOptions;

for (var k in ConfFu) {
	ConfFuCLI[k] = ConfFu[k];
}

module.exports = ConfFuCLI;
