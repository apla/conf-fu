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
		fixupLoaded: null,
		alienRead:      null
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

	var ioWait = 0;

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

	this.on ('ready', function () {
		if (self.verbose) {console.log (paint.confFu (), 'config ready');}
		self.ready = true;
	});

	this.on ('notReady', function () {
		if (self.verbose) {console.error (paint.confFu (), paint.error ('config not ready'));}
		self.ready = false;
	});

	this.on ('fixupApplied', function () {
		if (self.verbose) {
			console.error (paint.confFu (), 'fixup applied');
		}
	});

	this.on ('error', this.errorHandler.bind (this));

	if (options.projectRoot)
		this.projectRoot  = new io (options.projectRoot);

	if (!options.configFile && !options.configName) {
		this.emit ('error', 'core', 'file', "you must define 'configFile' or 'configName' option", null);
		return;
	}

	if (options.configName && options.configFile) {
		this.emit ('error', 'core', 'file', "you can use exact name for config file with 'configFile' option, or allow to search file by name with any supported format by using 'configName'", null);
		return;
	}

	if (options.fixupName && options.fixupFile) {
		this.emit ('error', 'fixup', 'file', "you can use exact name for fixup file with 'fixupFile' option, or allow to search file by name with any supported format by using 'fixupName'", null);
		return;
	}

	if (options.configRoot) {
		this.configRoot = new io (options.projectRoot
			? path.join (options.projectRoot, options.configRoot)
			: options.configRoot
		);
		if (options.configFile) this.configFile = new io (this.getFilePath (process.cwd(), options.configFile));
		if (options.configName) this.configName = options.configName;
	} else {
		// TODO: configName not supported if configRoot undefined
		this.configFile = new io (options.configFile);
		this.configRoot = this.configFile.parent();
	}

	this.setupVariables = options.setupVariables || {};

	this.instance     = options.instance;
	if (options.instanceFile)
		this.instanceFile = new io (this.getFilePath (process.cwd(), options.instanceFile));

	//if (options.configRoot) { /// WTF???
	//	this.instanceFile = new io (options.instanceFile);
	//}

	if (options.alienFiles)
		this.alienFiles  = options.alienFiles;

	if (!options.fixupFile && !options.fixupName) {
		this.emit ('error', 'fixup', 'file', "fixup file name is undefined", null);
	}

	// TODO: exclusive lock on config file to prevent multiple running scripts
	process.nextTick (this.loadAll.bind (this, options.fixupFile, options.fixupName));

}

inheritsMixin (ConfFuIO, ConfFu, EventEmitter);

//console.log (Object.keys ((new ConfFuIO ()).prototype));

module.exports = ConfFuIO;

ConfFuIO.paint = paint;

ConfFuIO.prototype.loadAll = function (fixupFile, fixupName) {
	this.findConfigFile ();
	this.findFixupFile (fixupFile, fixupName);
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

var ioWait = 0;
ConfFuIO.prototype.ioDone = function (tag) {
	var self = this;
	ioWait++;
	//console.log ('ioWait++', dirsToProcess);
	return function () {
		ioWait --;
		//console.log ('ioWait--', dirsToProcess);
		if (!ioWait)
			setTimeout (function () {
				if (!ioWait)
					self.emit (tag || 'done');
			}, 100);
	}.bind (this);
}


ConfFuIO.prototype.applyFixup = function () {
	if (this.checkList.coreLoaded === null || this.checkList.fixupLoaded === null) {
		return;
	}

	var isReady = this.super_.prototype.applyFixup.call (this);

	// user can launch hooks after fixup applied event

	var self = this;
	// here we have two possibilities:
	// 1) alien file not read because enchanted filename
	// 2) alien file was read but have additional variables to resolve
	if (this.alienFiles && !this.checkList.alienRead) {
		for (var alienFileTmpl in this.alienFiles) {
			this.analyzeAlien (
				this.alienFiles[alienFileTmpl].tmpl,
				this.alienFiles[alienFileTmpl].file,
				this.ioDone ('alien-read')
				//this.alienFiles[alienFileTmpl].cb
			);
			this.ioWait ++;
		}

		this.on ('alien-read', this.applyFixup.bind (this));

		this.checkList.alienRead = true;
		return;
	}

	this.emit ('fixupApplied');

	var readyEventName = isReady ? 'ready' : 'notReady';
	if (this.ioWait > 0) {
		this.onIOFinish = this.emit.bind (this, readyEventName);
	} else {
		this.emit (readyEventName);
	}

	if (!isReady) {
		this.emit ('error', 'config', 'variables', this.unpopulatedVariables ());
	}
};

ConfFuIO.prototype.addAlien = function (alienFileTmpl, alienFile, cb) {
	this.alienFiles = this.alienFiles || {};
	this.alienFiles[alienFileTmpl.path || alienFileTmpl] = {
		tmpl: alienFileTmpl,
		file: alienFile,
		cb:   cb
	};
}

ConfFuIO.prototype.analyzeAlien = function (alienFileTmpl, alienFile, cb) {

	if (!(alienFileTmpl instanceof io)) {
		var enchanted = this.isEnchantedValue (alienFileTmpl);
		if (enchanted) {
			var realAlienFileTmpl = enchanted.interpolated (this.config);
			if (realAlienFileTmpl)
				alienFileTmpl = realAlienFileTmpl;
		}

		alienFileTmpl = new io (alienFileTmpl);
	}

	var self = this;

	alienFileTmpl.readFile (function (err, data) {
		if (err) {
			self.emit ('error', 'alien', 'file', err, alienFileTmpl.path);
			self.ioWait --;
			cb && cb (err);
			return;
		}

		// TODO: stream parser
		var value = data.toString();

		var enchanted = self.isEnchantedValue (value);
		if (enchanted) {

			var interpolated = enchanted.interpolated (self.config);
//			console.log ('ALIEN INTERPOLATE', interpolated === undefined, enchanted.asVariables);
			if (interpolated === undefined) {
//				console.log ('ALIEN INTERPOLATE ERROR');
				self.emit ('error', 'alien', 'variables', enchanted.asVariables);
				self.setVariables (enchanted.asVariables, true);
				// TODO: emit something if cb is undefined?
				self.ioWait --;
				cb && cb (enchanted.error, interpolated);
				return;
			}
		}

		if (alienFile === false || alienFile === null) {
			// WTF: use case?
			// TODO: emit something if cb is undefined?
			self.ioWait --;
			cb && cb (error, interpolated);
			return;
		} else if ((alienFile === true || alienFile === undefined) && alienFileTmpl.extension === self.alienExt) {
			alienFile = new io (alienFileTmpl.path.slice (0, -1 * (self.alienExt.length + 1)));
		} else if (!(alienFile instanceof io)) { // assumed string path
			var enchanted = self.isEnchantedValue (alienFile);
			if (enchanted) {
				var realAlienFile = enchanted.interpolated (self.config);
				if (realAlienFile)
					alienFile = realAlienFile;
			}
			alienFile = new io (alienFile);
		}

		alienFile.writeFile (interpolated, function (err) {
			self.ioWait --;
			cb && cb (err, interpolated, alienFile);
		});


	});
}


ConfFuIO.prototype.interpolateAlien = function (alienFileTmpl, alienFile, cb) {
	if (!(alienFileTmpl instanceof io)) {
		alienFileTmpl = new io (alienFileTmpl);
	}

	var self = this;

	self.ioWait ++;

	alienFileTmpl.readFile (function (err, data) {
		if (err) {
			self.emit ('error', 'alien', 'file', err, alienFileTmpl.path);
			self.ioWait --;
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
			self.ioWait --;
			cb && cb (error, interpolated);

			return;
		};

		if (alienFile === false || alienFile === null) {
			// TODO: emit something if cb is undefined?
			self.ioWait --;
			cb && cb (error, interpolated);

			return;
		} else if ((alienFile === true || alienFile === undefined) && alienFileTmpl.extension === self.alienExt) {
			alienFile = new io (alienFileTmpl.path.slice (0, -1 * (self.alienExt.length + 1)));
		} else if (!(alienFile instanceof io)) { // assumed string path
			alienFile = new io (alienFile);
		}

		alienFile.writeFile (interpolated, function (err) {
			self.ioWait --;
			cb && cb (err, interpolated, alienFile);
		});


	});
}

ConfFuIO.prototype.findConfigFile = function (done) {
	if (this.configFile) {
		this.configFile.readAndParseFile (this.onConfigRead.bind (this));
	} else if (this.configName) {
		this.searchForFile (this.configName, this.configRoot, function (fileName) {
			this.configFile = new io (this.getFilePath (process.cwd(), fileName));
			this.configFile.readAndParseFile (this.onConfigRead.bind (this));
		}.bind (this));
	};
}

ConfFuIO.prototype.findFixupFile = function (fixupFile, fixupName) {
	if (fixupFile) {
		var ff = this.getFilePath (process.cwd(), fixupFile);
		this.fixupEnchantment;
		if (this.fixupEnchantment = this.isEnchantedValue (ff)) {
			// TODO: check and die when another variables is present
			if (this.instance) {
				ff = this.fixupEnchantment.interpolated ({
					instance: this.instance
				});
				if (ff)
					this.fixupFile = new io (ff);
			}
		} else {
			this.fixupFile = new io (ff);
		}
		if (this.fixupFile)
			this.fixupFile.readAndParseFile (this.onFixupRead.bind (this));
	} else if (fixupName) {
		this.searchForFile (fixupName, this.configRoot, this.findFixupFile.bind (this));
	}
}

ConfFuIO.prototype.searchForFile = function (name, dir, done) {
	fs.readdir (dir.path, function (err, files) {
		for (var fNo = 0; fNo < files.length; fNo ++) {
			if (path.basename (files[fNo], path.extname (files[fNo])) === name) {
				done (files[fNo]);
				break;
			}
		}
	}.bind (this));
}

ConfFuIO.prototype.onInstanceRead = function (err, data) {
	if (err) {
		this.emit ('error', 'instance', 'file', err, this.instanceFile.path);
		return;
	}

	this.instance = data.toString().trim();

	var fixupFile;
	if (this.fixupEnchantment)
		fixupFile = this.fixupEnchantment.interpolated ({
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
			var instanceName = [
				(process.env.USER || process.env.USERNAME),
				(process.env.HOSTNAME || process.env.COMPUTERNAME)
			].join ('@');
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
	// ensure fixup is defined
	// TODO: migration from instance-based

	this.super_.prototype.setVariables.apply (this, arguments);

	if (this.fixupFile) {
		// TODO: create fixup directory or display message for user

		// wrote config to the fixup file
		var validFixupString;
		if (this.fixupFile.stringify)
			validFixupString = this.fixupFile.stringify (this.fixup);

		if (validFixupString) {
			this.ioWait ++;
			this.fixupFile.writeFile (validFixupString, function (err) {
				if (err) {
					console.error (paint.confFu(), 'write error for ', paint.path (this.fixupFile.path), ':', err);
				}
				this.ioWait --;
			}.bind (this));
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
		this.emit ('error', 'fixup', 'file', err, this.fixupFile);
		this.checkList.fixupLoaded = false;
		this.fixup = {};
		this.applyFixup ();
		return;
	}

	if (!parsed || parsed.error) {
		if (!parsed) console.log (arguments);
		this.emit ('error', 'fixup', 'parse', (parsed ? parsed.error : null), this.fixupFile); // type error when parsed not defined
		return;
	}

	this.emit ('read', 'fixup', this.fixupFile);

	this.fixup = parsed.object;

	this.emit ('fixupLoaded');
};

ConfFuIO.prototype.onConfigRead = function (err, data, parsed) {

	if (err) {
		var message = "can't access '" + this.configFile.shortPath() + "' file ("+err.code+")";
		console.error (paint.confFu(), paint.error (message));
		this.emit ('error', 'core', 'file', err, this.configFile);
		return;
	}
	if (!parsed || parsed.error) {
		var message = "cannot parse '" + this.configFile.shortPath() + "' file";
		console.error (paint.confFu(), paint.error (message));
		this.emit ('error', 'core', 'parse', (parsed ? parsed.error : null), this.configFile);
		return;
	}

	this.emit ('read', 'config', this.configFile);

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

ConfFuIO.prototype.logVariables = function() {
	console.log (paint.confFu (), 'variables:');
	for (var varPath in this.setupVariables) {
		var prefix = '[setup]';
		// TODO: show overriden values
		var value = (this.setupVariables[varPath] && this.setupVariables[varPath].constructor === Array)
			? this.setupVariables[varPath][0]
			: this.setupVariables[varPath];
		console.log ("\t", prefix, paint.path(varPath), '=', value);
		//		this.variables[varPath] = value || "<#undefined>";
	}
	for (varPath in this.variables) {
		var value = (this.variables[varPath] && this.variables[varPath].constructor === Array)
			? this.variables[varPath][1]
			: this.variables[varPath];
		console.log ("\t", paint.path(varPath), '=', value);
//		this.variables[varPath] = value || "<#undefined>";
	}
};


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
		paint.error ((this.fixupFile? "" : "you must define fixup path, then") + "you can execute"),
		paint.confFu ("<variable> <value>"),
		"to define individual variables\n or edit",
		this.fixupFile ? paint.path (this.fixupFile.shortPath ()) : "fixup file",
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
					self.emit ('error', 'include', 'file', null, basePath);
					return;
				}

				if (!parsed || parsed.error) {
					this.emit ('error', 'include', 'parse', (parsed ? parsed.error : null), basePath); // TODO: type error when parsed not defined
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
	if (pathTemplate.match (/^\.+(\/|\\)/)) {
		pathTemplate = path.resolve (baseDir, pathTemplate);

	// 2. absolute path
	} else if (path.resolve (pathTemplate) === pathTemplate) {
		// nothing to do

	// 3. projectRoot, prefixed with 'project:'
	} else if (pathTemplate.indexOf ('project:') === 0) {
		pathTemplate = path.join (this.projectRoot.path, pathTemplate.substr (8));

	// 4. configRoot, prefixed with 'config:' or without prefix
	} else {
		pathTemplate = path.join (
			this.configRoot.path,
			pathTemplate.indexOf ('config:') === 0 ? pathTemplate.substr (7) : pathTemplate
		);
	}

	return pathTemplate;

};
