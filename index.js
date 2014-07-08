"use strict";

var path = require ('path');
var fs   = require ('fs');
var util = require ('util');

var EventEmitter = require ('events').EventEmitter;

var io    = require ('./io');
var paint = require ('./lib/color');

paint.error  = paint.bind (paint, "red+white_bg");
paint.path   = paint.cyan.bind (paint);
paint.confFu = paint.green.bind (paint, "conf-fu");

var ConfFu = require ('./base');

/**

 * ConfFu is constructor for config object instance

 * @param {type} projectRoot directory where whole project is located
 * @param {type} configRoot  directory for conf-fu configuration
 * @param {type} configFile  main conf-fu file
 * @param {type} fixupFile fixup conf-fu file
 * @param {type} instance project's current instance to detect fixup
 * @param {type} instanceFile file to read project instance

 examples:

 load config file, expand all includes, patch config with includes using config fixup
 confFu (configFile, fixupFile);

 */

//
function inheritsMixin (sub, sup) {
	sub.prototype = Object.create (sup.prototype);
	var sprot = sub.prototype;

	sprot.super_  = sup;
	sprot.super_.init = sup.bind (sub);

	for (var key in sup) {
		if (sup.hasOwnProperty(key)) {
			sub[key] = sup[key];
		}
	}

	var mixins = [].slice.call (arguments, 2);
	mixins.forEach (function (mixin) {
		Object.keys (mixin.prototype).forEach (function(key) {
			sprot[key] = mixin.prototype[key];
		});
	});

	sprot.mixins_ = mixins;
	sprot.mixins_.init = function () {
		mixins.forEach (function (mixin) {
			mixin.call (sub);
		});
	}
}

function ConfFuIO (options) {
//	this.super_.init  (); // we must init super after all needed files is loaded
	this.mixins_.init ();

	this.alienExt = 'conf-fu';

	this.checkList = {
		coreLoaded:     null,
		includesLoaded: null,
		fixupLoaded:    null,
	};

	var self = this;

	this.on ('configLoaded', function () {
		self.checkList.coreLoaded = true;
		self.applyFixup ();
	});

	this.on ('fixupLoaded', function () {
		self.checkList.fixupLoaded = true;
		self.applyFixup ();
	});

	var ioWait;

	Object.defineProperty(this, 'ioWait', {
		get: function () {
			return ioWait;
		},
		set: function (value) {
			ioWait = value;
			if (ioWait === 0 && self.onIOFinish) {
				self.onIOFinish ();
				delete self.onIOFinish;
			}
		}
	});

	this.on ('error', this.errorHandler.bind (this));

	this.configFile   = new io (options.configFile);

	if (options.configRoot) {
		this.configRoot = new io (options.configRoot);
	} else {
		this.configRoot = this.configFile.parent();
	}

	this.instance     = options.instance;
	if (options.instanceFile)
		this.instanceFile = new io (options.instanceFile);

	if (options.configRoot) {
		this.instanceFile = new io (options.instanceFile);
	}
	if (options.projectRoot)
		this.projectRoot  = new io (options.projectRoot);

	var fixupFile = options.fixupFile;
	if (fixupFile) {
		this.fixupEnchantment;
		if (this.fixupEnchantment = this.isEnchantedValue (fixupFile)) {
			// TODO: check and die when another variables is present
			if (this.instance) {
				fixupFile = this.fixupEnchantment.interpolated ({
					instance: this.instance
				});
				if (fixupFile)
					this.fixupFile = new io (fixupFile);
			}
		} else {
			this.fixupFile = new io (fixupFile);
		}
	} else {
		this.emit ('error', 'fixup', 'file', "fixup file name is undefined", null);
	}

	// TODO: exclusive lock on config file to prevent multiple running scripts
	process.nextTick (this.loadAll.bind (this));

}

inheritsMixin (ConfFuIO, ConfFu, EventEmitter);

//console.log (Object.keys ((new ConfFuIO ()).prototype));

module.exports = ConfFuIO;

ConfFuIO.paint = paint;

ConfFuIO.prototype.loadAll = function () {
	this.configFile.readAndParseFile (this.onConfigRead.bind (this));
	if (this.fixupFile)
		this.fixupFile.readAndParseFile (this.onFixupRead.bind (this));
	if (this.instanceFile)
		this.instanceFile.readFile (this.onInstanceRead.bind (this));

};

ConfFuIO.prototype.errorHandler = function (eOrigin, eType, eData, eFile) {
	// origin can be config, fixup or include
	// type can be file, parser, variables

	var logger = console.error.bind (console);

	if (!this.verbose) {
		logger = function () {};
	}

	if (eType === 'parse') {
//		console.log ('!!!!!!!!!!!!!!!!!!!!!!!!', eFile, this);
		var message = 'Config ' + eOrigin + ' (' + paint.path (eFile.path || eFile) + ') cannot be parsed:';
		if (eData === null) {
			logger (message, paint.error ('unknown format'));
			logger (
				'You can add new formats using ConfFu.prototype.formats.',
				'Currently supported formats:',
				Object.keys (ConfFu.prototype.formats).join (', ')
			);
		} else {
			logger (message, paint.error (eData));
		}
	} else if (eType === 'file') {
		this.checkList[eOrigin+'Loaded'] = false;
		logger ("Config", eOrigin, "file error:", paint.error (eData));
		if (eOrigin === 'fixup') {

		} else {
			// TODO: maybe process.kill?
		}

	} else if (eType === 'variables') {
		this.logUnpopulated (eData);
	}


};

ConfFuIO.prototype.applyFixup = function () {
	if (this.checkList.coreLoaded === null || this.checkList.fixupLoaded === null) {
		return;
	}

	if (this.super_.prototype.applyFixup.call (this)) {
		if (this.ioWait > 0) {
			this.onIOFinish = this.emit.bind (this, 'ready');
		} else {
			this.emit ('ready');
		}
		// TODO: wait for all file operations to complete
		this.ready = true;
	} else {
		this.emit ('error', 'config', 'variables', this.unpopulatedVariables ());
	}
};

ConfFuIO.prototype.interpolateAlien = function (alienFileTmpl, alienFile, cb) {
	if (!(alienFileTmpl instanceof io)) {
		alienFileTmpl = new io (alienFileTmpl);
	}

	var self = this;

	alienFileTmpl.readFile (function (err, data) {
		if (err) {
			self.emit ('error', 'alien', 'file', err, alienFileTmpl.path);
			return;
		}

		// TODO: stream parser
		var value = data.toString();

		// TODO: remove copy-paste
		var variableReg   = /<((\$)((int|quoted|bool)(\(([^\)]*)\))?:)?([^>=]+)(=([^>]*))?)>/gi;
		var marks = {start: '<', end: '>', typeRaw: '$', typeSafe: '🐸'};
		var toInterpolate = value.replace (variableReg, "<$$$7>");
		var interpolated, error;
		try {
			interpolated = ConfFuIO.interpolate (toInterpolate, self.config, marks, true);
		} catch (e) {
			error = e;
			self.emit ('error', 'alien', 'variables', e);
			self.setVariables (e, true);
			// TODO: emit something if cb is undefined?
			cb && cb (error, interpolated);
			return;
		};

		if (alienFile === false || alienFile === null) {
			// TODO: emit something if cb is undefined?
			cb && cb (error, interpolated);
			return;
		} else if ((alienFile === true || alienFile === undefined) && alienFileTmpl.extension === self.alienExt) {
			alienFile = new io (alienFileTmpl.path.slice (0, -1 * (self.alienExt.length + 1)));
		} else if (!(alienFile instanceof io)) { // assumed string path
			alienFile = new io (alienFile);
		}

		alienFile.writeFile (interpolated, function (err) {
			cb && cb (err, interpolated, alienFile);
		});


	});
}

ConfFuIO.prototype.onInstanceRead = function (err, data) {
	if (err) {
		this.emit ('error', 'instance', 'file', err, this.instanceFile.path);
		return;
	}

	this.instance = data.toString().trim();

	var fixupFile = this.fixupEnchantment.interpolated ({
		instance: this.instance
	});

	if (fixupFile) {
		this.fixupFile = new io (fixupFile);
		this.fixupFile.readAndParseFile (this.onFixupRead.bind (this));
	}
}

ConfFuIO.prototype.readInstance = function () {
	var self = this;
	this.instance = process.env.PROJECT_INSTANCE;
	if (this.instance) {
		console.log (paint.confFu(), 'instance is:', paint.path (this.instance));
		self.emit ('instantiated');
		return;
	}
	var instanceFile = this.root.fileIO (path.join (this.varDir, 'instance'));

	instanceFile.readFile (function (err, data) {

		if (err) {
			var instanceName = process.env.USER + '@' + process.env.HOSTNAME;
			// it is ok to have instance name defined and have no instance
			// or fixup file because fixup is empty
			self.instance = instanceName;
			self.root.fileIO (path.join (self.varDir, instanceName)).mkdir ();
			instanceFile.writeFile (instanceName);
			self.emit ('instantiated');
			return;
		}

		// assume .dataflows dir always correct
		// if (err && self.varDir != '.dataflows') {
			// console.error ("PROBABLY HARMFUL: can't access "+self.varDir+"/instance: "+err);
			// console.warn (paint.confFu(), 'instance not defined');
		// } else {

		var instance = data.toString().split (/\n/)[0];
		self.instance = instance == "undefined" ? null : instance;
		var args = [paint.confFu(), 'instance is:', paint.path (instance)];
		if (err) {
			args.push ('(' + paint.error (err) + ')');
		} else if (self.legacy) {
			console.error ("\tmv var/instance .dataflows/");
		}
		if (self.legacy) {
			console.log ();
		}
		console.log.apply (console, args);
		// }

		self.emit ('instantiated');
	});
};

ConfFuIO.prototype.setVariables = function (fixupVars, force) {
	var self = this;
	// ensure fixup is defined
	// TODO: migration from instance-based

	self.super_.prototype.setVariables.apply (self, arguments);

	if (this.fixupFile) {
		// wrote config to the fixup file
		var validFixupString;
		if (this.fixupFile.stringify)
			validFixupString = this.fixupFile.stringify (this.fixup);

		if (validFixupString) {
			self.ioWait ++;
			this.fixupFile.writeFile (validFixupString, function () {
				// TODO: error handling for fixup write
				self.ioWait --;
			});
		}
	} else {
		console.error (paint.confFu(), 'fixup file name is undefined, cannot write to the fixup file');
		if (Object.keys (fixupVars).length) {

//			process.kill ();
		}
	}

};

ConfFuIO.prototype.onFixupRead = function (err, data, parsed) {

	if (err) {
		this.emit ('error', 'fixup', 'file', err, this.fixupFile.path);
		return;
	}

	if (!parsed || parsed.error) {
		if (!parsed) console.log (arguments);
		this.emit ('error', 'fixup', 'parse', parsed.error, this.fixupFile.path); // type error when parsed not defined
		return;
	}

	this.fixup = parsed.object;

	this.emit ('fixupLoaded');
};

ConfFuIO.prototype.onConfigRead = function (err, data, parsed) {

	if (err) {
		var message = "Can't access '" + this.configFile.path + "' file ("+err.code+")";
		console.error (paint.confFu(), paint.error (message));
		this.emit ('error', 'core', 'file', err);
		return;
	}
	if (!parsed || parsed.error) {
		var message = "Cannot parse '" + this.configFile.path + "' file";
		console.error (paint.confFu(), paint.error (message));
		this.emit ('error', 'core', 'parse', err);
		return;
	}

	var config = parsed.object;

	this.id = config.id;

	var self = this;
	// TODO: load includes after fixup is loaded
	this.loadIncludes(config, 'projectRoot', this.configFile.path, function (err, config, variables, placeholders) {

		self.variables    = variables;
		self.placeholders = placeholders;

		if (err) {
			console.error (err);
			console.warn ("Couldn't load includes.");
			// actually, failure when loading includes is a warning, not an error
		}

		self.config = config;

		self.emit ('configLoaded');
	});
};

var configCache = {};

ConfFuIO.prototype.logUnpopulated = function(varPaths) {
	var logger = console.error.bind (console);

	if (!this.verbose) {
		logger = function () {};
	}

	logger (paint.error ("those config variables is unpopulated:"));
	for (var varPath in varPaths) {
		var value = (varPaths[varPath] && varPaths[varPath].constructor === Array) ? varPaths[varPath][0] : varPaths[varPath];
		logger ("\t", paint.path(varPath), '=', value);
		varPaths[varPath] = value || "<#undefined>";
	}
	var messageChunks = [
		this.fixupFile? "" : "you must define fixup path, then",
		"you can run",
		"\n" + paint.confFu ("TODO: <variable> <value>"),
		"\nto define individual variables or edit",
		this.fixupFile ? paint.path (this.fixupFile.path) : "fixup file",
		"to define all those vars at once"
	];

	logger.apply (console, messageChunks);

	// console.log (this.logUnpopulated.list);
};


ConfFuIO.prototype.loadIncludes = function (config, level, basePath, cb) {
	var self = this;

	var DEFAULT_ROOT = this.configDir,
		DELIMITER = ' > ',
		cnt = 0,
		len = 0;

	var levelHash = {};

	var variables = {};
	var placeholders = {};

	level.split(DELIMITER).forEach(function(key) {
		levelHash[key] = true;
	});

	function onLoad() {
		cnt += 1;
		if (cnt == len) {
			cb (null, config, variables, placeholders);
		}
	}

	function onError(err) {
		console.log('[WARNING] Level:', level, 'is not correct.\nError:', paint.error (err));
		cb(err, config, variables, placeholders);
	}

	function iterateNode (node, key, depth) {
		var value = node[key];

		if ('string' !== typeof value) {
			return;
		}

		var enchanted = self.isEnchantedValue (value);
		if (!enchanted) {
			return;
		}
		if ("variable" in enchanted) {
			variables[depth.join ('.')] = [value];
			return;
		}
		if ("placeholder" in enchanted) {
			variables[depth.join ('.')] = [value];
			return;
		}
		if ("error" in enchanted) {
			self.emit ('error', 'include', 'parse', ('bad include tag:' + "\"" + value + "\""), (basePath.path || basePath));
			return;
		}
		if ("include" in enchanted) {
			len ++;
			var incPath = self.getFilePath (
				path.resolve (basePath, '..'), // get a directory name
				path.normalize (enchanted.include)
			);

			// TODO: check circular links
			if (incPath in levelHash) {
				//console.error('\n\n\nError: on level "' + level + '" key "' + key + '" linked to "' + value + '" in node:\n', node);
				throw new Error('circular linking');
			}

			delete node[key];

			if (configCache[incPath]) {

				node[key] = ConfFuIO.clone (configCache[incPath]);
				onLoad();
				return;

			}

			var incPathIO = new io (incPath);

			incPathIO.readAndParseFile (function (err, data, parsed) {
				if (err) {
					self.emit ('error', 'include', 'file', null, (basePath.path || basePath));
					return;
				}

				if (!parsed || parsed.error) {
					this.emit ('error', 'include', 'parse', parsed.error, (basePath.path || basePath)); // TODO: type error when parsed not defined
					return;
				}

				self.loadIncludes(
					parsed.object,
					path.join(level, DELIMITER, incPath),
					incPath,
					function(tree, includeConfig) {
						configCache[incPath] = includeConfig;

						node[key] = ConfFuIO.clone(configCache[incPath]);
						onLoad();
					}
				);
			});

		}
	}

	this.iterateTree(config, iterateNode, []);

//	console.log('including:', level, config);

	!len && cb(null, config, variables, placeholders);
};

ConfFuIO.prototype.getFilePath = function (baseDir, pathTemplate) {

	// here you can use some options to define include location:
	// 1. relative path (with . or ..)
	if (pathTemplate.match (/\.+(\/|\\)/)) {
		pathTemplate = path.resolve (baseDir, pathTemplate);

	// 2. absolute path
	} else if (path.resolve (pathTemplate) === pathTemplate) {
		// nothing to do

	// 3. configRoot, prefixed with 'config:' or without prefix
	} else if (pathTemplate.indexOf ('project:') === 0) {
		pathTemplate = path.join (this.projectRoot.path, pathTemplate.substr (8));

	// 4. projectRoot, prefixed with 'project:'
	} else {

		pathTemplate = path.join (
			this.configRoot.path,
			pathTemplate.indexOf ('config:') === 0 ? pathTemplate.substr (7) : pathTemplate
		);
	}

	return pathTemplate;

};
