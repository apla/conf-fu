var confFu = require ('./index');

function onConfigReady (options) {
	// options must be handled before variables setup
	if (options.dump === 'json') {
		console.log (JSON.stringify (this.config, null, "\t"));
		return;
	}

	var fixupVars = {};
	options._.forEach (function (item, idx, arr) {
		if (idx % 2)
			return;
		fixupVars[item] = [arr[idx + 1]];
	});
	// console.log (fixupVars);
	// fixupVars[context.varPath] = [context.value];
	this.setVariables (fixupVars, true);

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
	
module.exports = {
	onConfigError: onConfigError,
	onConfigReady: onConfigReady
};