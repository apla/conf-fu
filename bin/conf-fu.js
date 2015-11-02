#!/usr/bin/env node

var ConfFu = require ('../');

var paint = ConfFu.paint;
var commop = require ("commop");

var cli = {
	"options": {
		"verbose": {
			"alias": "v",
			"type": "boolean",
			"description": "verbose output",
			"default": false,
			"global": true,
			"env": "VERBOSE"
		},
		"dryRun": {
			"alias": ["dry-run", "n"],
			"type": "boolean",
			"description": "just show commands, don't do anything",
			"default": false,
			"global": true
		},
		configFile: {
			"alias": ["config"],
			"description": "core config file to process",
			"global": true,
			//"required": true,
			"env": "CONF_FU"
		},
		fixupFile: {
			"alias": ["fixup"],
			"description": "fixup config to apply on core",
			"global": true,
			"env": "CONF_FU_FIXUP"
		},
		instance: {
			description: "config instance name",
			env: ["CONF_FU_INSTANCE", "INSTANCE"]
		},
	},
	commands: {
		dump: {
			description: "dump current config as JSON",
			run: [parseConfig, function (cliCmd, data, cb) {
				if (cliCmd.positional[0] && cliCmd.positional[0] in data.config) {
					console.log (JSON.stringify (data.config[cliCmd.positional[0]], null, "\t"));
					return;
				}
				console.log (JSON.stringify (data.config, null, "\t"));
				return;
			}]
		},
		vars: {
			description: "show available variables",
			run: [parseConfig, function (conf, data, cb) {
				this.logVariables ();
			}]
		},
		// TODO: add set command
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
			options: {
				configFile: {required: true}
			},
			run: [checkBasics, runEditor]
		},
		help: {
			alias: "h",
			anyway: true, // anyway here has no effect
			before: true
		}
	},
	"usage": [
		paint.confFu() + " is a configuration helper.",
		"",
		"You can use this utility to parse configuration files, find variables and placeholders",
		"or edit configuration files"
	]
};

var launcher = new commop (cli);

process.nextTick (function () {
	launcher.start();
});

function checkBasics (conf, data, cb) {
	console.log ('TODO: add check for required in global options');
	cb (true);
}

function onConfigReady (cliCmd, data, cb) {
	// console.log ("ready");
	data.config = this;
	cb (true);
}

function onConfigFail (cliCmd, data, cb) {
	// console.log ("failed");
	if (cliCmd.config.anyway) {
		cb (true);
	}

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

function parseConfig (conf, data, cb) {

	var conffu = new ConfFu (conf.options);

	// console.log (conf);

	conffu.verbose = true;

	conffu.on ('ready',    onConfigReady.bind (conffu, conf, data, cb));
	conffu.on ('notReady', onConfigFail.bind  (conffu, conf, data, cb));
	conffu.on ('error',    onConfigError.bind (conffu, conf, data, cb));
}

function runEditor (conf, data, cb) {

	var fileName;

	if (conf.positional[0] === "fixup") {
		fileName = conf.options.fixupFile;
	} else if (conf.positional[0] === "core") {
		fileName = conf.options.configFile;
	}

	// console.log (fileName);

	var child_process = require ('child_process');

	var editor = process.env.EDITOR || 'vim';

	var child = child_process.spawn(editor, [fileName], {
		stdio: 'inherit'
	});

	child.on('exit', function (e, code) {
		// console.log("finished");
	});
}

