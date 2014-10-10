var ConfFu = require ('./index');

var paint = ConfFu.paint;
var yargs = require ("yargs");

function runEditor (fileName) {
	var child_process = require ('child_process');

	var editor = process.env.EDITOR || 'vim';

	var child = child_process.spawn(editor, [fileName], {
		stdio: 'inherit'
	});

	child.on('exit', function (e, code) {
		console.log("finished");
	});
}

var cli = {
	verbose: {
		alias: "v",
		boolean: true,
		description: "verbose output",
		default: false
	},
	dryRun: {
		alias: ["n", "dry-run"],
		boolean: true,
		description: "don't validate settings",
		default: false
	},
	configFile: {
		alias: ["config"],
		description: "core config file to process",
		env: "CONF_FU"
	},
	fixupFile: {
		alias: ["fixup"],
		description: "fixup config to apply on core",
		env: "CONF_FU_FIXUP"
	},
	instance: {
		description: "config instance name",
		env: ["CONF_FU_INSTANCE", "INSTANCE"]
	},
	dump: {
		description: "dump current config as JSON",
		run: function (options) {
			if (options.dump.constructor !== Boolean && options.dump in this.config) {
				console.log (JSON.stringify (this.config[options.dump], null, "\t"));
				return;
			}
			console.log (JSON.stringify (this.config, null, "\t"));
			return;
		}
	},
	vars: {
		description: "show available variables",
		run: function () {
			this.logVariables ();
		}
	},
	_: {
		anyway: true, // launch anyway, even if error is present
		run: function (options) {
			// this is a bit hackish function.
			// if we found orphan parameters, we launch this function to set parameters
			if (options._ && options._.length > 0 && options._.length % 2 === 0) {

				var fixupVars = {};
				options._.forEach (function (item, idx, arr) {
					if (idx % 2)
						return;
					fixupVars[item] = [arr[idx + 1]];
					console.log ('variable', item, 'assigned to the', arr[idx + 1]);
				});
				// console.log (fixupVars);
				// fixupVars[context.varPath] = [context.value];
				this.setVariables (fixupVars, true);
			}

		},
	},
	edit: {
		anyway: true, // launch anyway, even if validation fails
		description: "run default editor for config, `core` or `fixup`",
		run: function (options) {
			if (options.edit === "fixup") {
				runEditor (this.fixupFile.path);
			} else if (options.edit === "core") {
				runEditor (this.configFile.path);
			}
		}
	},
	help: {
		alias: "h",
		anyway: true, // anyway here has no effect
		before: true,
		banner: paint.confFu() + " usage:"
	}
};



function initOptions () {

	yargs.usage (initOptions.cli.help.banner, initOptions.cli);
	yargs.help ('help', initOptions.cli.help.description);
	var options = yargs.parse (process.argv.slice (2));

	for (var k in initOptions.cli) {
		// clean up options a little
		var aliases = initOptions.cli[k].alias;
		if (aliases) {
			if (aliases.constructor !== Array)
				aliases = [aliases];
			aliases.forEach (function (aliasName) {
				if (aliasName in options && aliasName !== k) {
					options[k] = options[aliasName]; // not really needed, insurance for a yargs api changes
					delete options[aliasName];
				}
			});
		}
		if (!initOptions.cli[k].env)
			continue;
		if (options[k])
			continue;

		var envVars = initOptions.cli[k].env;
		if (envVars.constructor !== Array)
			envVars = [envVars];
		envVars.forEach (function (envVar) {
			if (process.env[envVar])
				options[k] = process.env[envVar];
		});
	}

	return options;
}

initOptions.cli = cli;

function findCommand (options) {
	var haveCommand;
	var haveParams  = options._;
	for (var k in options) {
		if (!(k in cli))
			continue;
		if (haveCommand && k !== '_' && cli[k].run) {
			console.error (paint.confFu (), 'you cannot launch two commands at once:', [
				paint.path (k), paint.path (haveCommand)
			].join (' and '));
			return;
		}
		if (k !== '_' && cli[k].run) {
			haveCommand = k;
		}
	}
	return haveCommand;
}

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

// Gracefully close log
process.on('uncaughtException', function (e) {
	// TODO: need to close all filehandles
	console.log ('uncaught exception', e);
});

module.exports = ConfFuCLI;
