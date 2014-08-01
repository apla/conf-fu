var ConfFu = require ('./index');

var paint = ConfFu.paint;

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
	dump: function () {
		console.log (JSON.stringify (this.config, null, "\t"));
		return;
	},
	vars: function () {
		this.logVariables ();
	},
	_: function () { // this is a bit hackish function. if we found orphan parameters, we launch this function to set parameters

	},
	edit: function (options) {
		if (options.edit === "fixup") {
			runEditor (this.fixupFile.path);
		} else if (options.edit === "core") {
			runEditor (this.configFile.path);
		}
	}
};

cli.editAnyway = cli.edit;

function onConfigReady (options) {
	// options must be handled before variables setup

	var haveCommand;
	var haveParams  = options._;
	for (var k in options) {
		if (!(k in cli))
			continue;
		if (haveCommand) {
			console.error (paint.confFu (), 'you cannot launch two commands at once:', [
				paint.path (k), paint.path (haveCommand)
			].join (' and '));
			return;
		}
		if (k !== '_') {
			haveCommand = k;
		}
	}

	if (haveCommand) {
		cli[haveCommand].apply (this, arguments);
		return;
	}

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

}

function onConfigFail (options) {
	var haveCommand;
	var haveParams  = options._;

	for (var k in options) {
		if (!(k+'Anyway' in cli))
			continue;
		if (haveCommand) {
			console.error (paint.confFu (), 'you cannot launch two commands at once:', [
				paint.path (k), paint.path (haveCommand)
			].join (' and '));
			return;
		}
		haveCommand = k+'Anyway';
	}

	if (haveCommand) {
		cli[haveCommand].apply (this, arguments);
		return;
	}

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
}

function onConfigError (options, eOrigin, eType, eData, eFile) {
	// origin can be config, fixup or include
	// type can be file, parser, variables

	var logger = console.error.bind (console);

	if (eType === 'parse') {
		process.kill ();
	} else if (eType === 'file') {
		if (eOrigin !== 'fixup') {
			process.kill ();
		}
	} else if (eType === 'variables') {
	}
}

function ConfFuCLI (options) {
	var conf = new ConfFu (options);

	conf.cli = cli;

	conf.on ('ready', onConfigReady.bind (conf, options));
	conf.on ('notReady', onConfigFail.bind (conf, options));
	conf.on ('error', onConfigError.bind (conf, options));

	return conf;
}

for (var k in ConfFu) {
	ConfFuCLI[k] = ConfFu[k];
}

module.exports = ConfFuCLI;
