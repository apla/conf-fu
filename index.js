"use strict";

var path = require ('path');
var fs   = require ('fs');
var util = require ('util');

var EventEmitter = require ('events').EventEmitter;

var io       = require ('./io');
var fsObject = require ('fsobject');
var paint    = require ('paintbrush');

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

	this.marks = options.marks;

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

	this.defaultExtension = options.defaultExtension || "json";

	if (options.projectRoot)
		this.projectRoot  = new io (options.projectRoot);

	if (!options.configFile && !options.configName) {
		this.emitDelayed ('error', 'core', 'file', "you must define 'configFile' or 'configName' option", null);
		return;
	}

	if (options.configName && options.configFile) {
		this.emitDelayed ('error', 'core', 'file', "you can use exact name for config file with 'configFile' option, or allow to search file by name with any supported format by using 'configName'", null);
		return;
	}

	if (options.fixupName && options.fixupFile) {
		this.emitDelayed ('error', 'fixup', 'file', "you can use exact name for fixup file with 'fixupFile' option, or allow to search file by name with any supported format by using 'fixupName'", null);
		return;
	}

	if (options.configRoot) {
		this.configRoot = new io (options.projectRoot
			? path.join (options.projectRoot, options.configRoot)
			: options.configRoot
		);
		if (options.configFile) this.configFile = new io (this.getFilePath (process.cwd(), options.configFile));
		if (options.configName) this.configName = new io (this.getFilePath (process.cwd(), options.configName));
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
		this.emitDelayed ('error', 'fixup', 'file', "fixup file name is undefined", null);
	}

	// TODO: exclusive lock on config file to prevent multiple running scripts
	process.nextTick (this.loadAll.bind (this, options.fixupFile, options.fixupName));

}

inheritsMixin (ConfFuIO, ConfFu, EventEmitter);

//console.log (Object.keys ((new ConfFuIO ()).prototype));

module.exports = ConfFuIO;

ConfFuIO.paint = paint;

ConfFuIO.prototype.emitDelayed = function (message, eOrigin, eType, eData, eFile) {
	process.nextTick (function () {
		this.emit (message, eOrigin, eType, eData, eFile);
		if (message === 'error') {
			if (eOrigin === 'core') {
				this.checkList.coreLoaded = false;
				this.applyFixup ();
			} else if (eOrigin === 'fixup') {
				// TODO
				// console.log (this.checkList, this.ioWait);
				// if (this.checkList.coreLoaded === null) this.emit ('notReady');
			}
		}
	}.bind (this));
}

ConfFuIO.prototype.loadAll = function (fixupFile, fixupName) {
	this.findConfigFile ();
	this.findFixupFile = this._findFixupFile.bind (this, fixupFile, fixupName);
	this.findFixupFile ();
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
	// console.log ('ioWait++');
	return function () {
		ioWait --;
		// console.log ('ioWait--');
		if (!ioWait)
			setTimeout (function () {
				if (!ioWait) {
					// console.log ('DONE');
					self.emit (tag || 'done');
				}
			}, 100);
	}.bind (this);
}


ConfFuIO.prototype.applyFixup = function () {
	if (
		this.checkList.coreLoaded === null
		|| (this.checkList.fixupLoaded === null && this.checkList.coreLoaded !== false)
	) {
		return;
	}

	if (this.checkList.coreLoaded === false) {
		this.emit ('notReady');
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
			this.interpolateAlien (
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

ConfFuIO.prototype.interpolateAlien = function (alienFileTmpl, alienFile, cb) {

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
		if (!enchanted) {
			self.ioWait --;
			cb && cb ();
			return;
		}

			var interpolated = enchanted.interpolated (self.config);
			// console.log ('ALIEN INTERPOLATE', interpolated === undefined, enchanted.asVariables);
			if (interpolated === undefined) {
				// console.log ('ALIEN INTERPOLATE ERROR');
				self.emit ('error', 'alien', 'variables', enchanted.asVariables);
				self.setVariables (enchanted.asVariables, true);
				// TODO: emit something if cb is undefined?
				self.ioWait --;
				cb && cb (enchanted.error, interpolated);
				return;
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

ConfFuIO.prototype.findConfigFile = function (done) {
	if (this.configFile) {
		this.configFile.readAndParseFile (this.onConfigRead.bind (this));
	} else if (this.configName) {

		this.searchForFile (this.configName.onlyName, this.configName.parent(), function (err, fileName) {
			if (err) {
				this.emit ('error', 'core', 'file', 'core config file is unaccessible', err);
				return;
			}
			this.configFile = new io (this.getFilePath (process.cwd(), fileName));
			this.configFile.readAndParseFile (this.onConfigRead.bind (this));
		}.bind (this));
	};
}

ConfFuIO.prototype._findFixupFile = function (fixupFile, fixupName) {
	if (this.fixupFile) return;

	if (fixupFile) {
		var ff = this.getFilePath (process.cwd(), fixupFile);
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
		var enchanted = this.isEnchantedValue (fixupName);
		if (!enchanted) {
			var fixupIO = new io (this.getFilePath (process.cwd(), fixupName));
			this.searchForFile (fixupIO.onlyName, fixupIO.parent(), function (err, fixupFileName) {
				if (err && err !== "noMatchForName") {
					this.onFixupRead (err);
					return;
				}
				this._findFixupFile (fixupName + path.extname (fixupFileName));
			}.bind (this));
		} else if (this.instance) {
			var fixupNamePlain = enchanted.interpolated ({
				instance: this.instance
			});
			if (!fixupNamePlain) {
				return;
			}
			var fixupIO = new io (this.getFilePath (process.cwd(), fixupNamePlain));
			this.searchForFile (fixupIO.onlyName, fixupIO.parent(), function (err, fixupFileName) {
				if (err && err !== "noMatchForName") {
					this.onFixupRead (err);
					return;
				}
				this._findFixupFile (fixupNamePlain + path.extname (fixupFileName));
			}.bind (this));
		}
	}
}

ConfFuIO.prototype.searchForFile = function (name, dir, done) {
	fs.readdir (dir.path, function (err, files) {
		if (err) return done (err);
		for (var fNo = 0; fNo < files.length; fNo ++) {
			if (path.basename (files[fNo], path.extname (files[fNo])) === name) {
				return done (null, files[fNo]);
			}
		}
		return done ("noMatchForName", name + '.' + this.defaultExtension);
	}.bind (this));
}

ConfFuIO.prototype.onInstanceRead = function (err, data) {
	if (err) {
		this.emit ('error', 'instance', 'file', err, this.instanceFile.path);
		this.onFixupRead ("cannot read fixup if instance undefined"); // with instance we decide which fixup to use
		return;
	}

	this.instance = data.toString().trim();

	this.findFixupFile ();
}

ConfFuIO.prototype.setVariables = function (fixupVars, force) {

	var changed = this.super_.prototype.setVariables.apply (this, arguments);

	this.fixupChanged = changed;

	// TODO: make sure every test case is covered in 06-dirs with fixupChanged
	// console.log ("setVariables changed:", changed);

	if (!changed) return;

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
		if (this.verbose) console.error (paint.confFu(), 'fixup file name is undefined, cannot write to the fixup file');
		if (Object.keys (fixupVars).length) {

//			process.kill ();
		}
	}

};

ConfFuIO.prototype.onFixupRead = function (err, data, parsed) {

	if (err && !data) {
		this.emit ('error', 'fixup', 'file', err, this.fixupFile);
		this.checkList.fixupLoaded = false;
		this.fixup = {};
		this.applyFixup ();
		return;
	}

	if (!parsed || parsed.error) {
		// if (!parsed) console.log (arguments);
		this.emit ('error', 'fixup', 'parse', (parsed ? parsed.error : null), this.fixupFile); // type error when parsed not defined
		return;
	}

	this.emit ('read', 'fixup', this.fixupFile);

	this.fixup = parsed.object;

	this.emit ('fixupLoaded');
};

ConfFuIO.prototype.onConfigRead = function (err, data, parsed) {

	if (err && !data) {
		var message = "can't access '" + this.configFile.shortPath() + "' file ("+err.code+")";
		if (this.verbose) console.error (paint.confFu(), paint.error (message));
		this.emit ('error', 'core', 'file', err, this.configFile);
		this.checkList.coreLoaded = false;
		this.applyFixup ();
		return;
	}

	if (!parsed || parsed.error) {
		var message = "cannot parse '" + this.configFile.shortPath() + "' file";
		if (this.verbose) console.error (paint.confFu(), paint.error (message));
		this.emit ('error', 'core', 'parse', (parsed ? parsed.error : null), this.configFile);
		this.checkList.coreLoaded = false;
		this.applyFixup ();
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
			// console.error (err);
			console.warn ("Couldn't load includes.");
			// actually, failure when loading includes is a warning, not an error
			// this.emit ('error', 'core', 'file', err, this.configFile);

			this.checkList.coreLoaded = false;
			this.applyFixup ();

			return;

		}

		self.config = config;

		self.emit ('configLoaded');
	}.bind (this));
};

var configCache = {};

ConfFuIO.prototype.logVariables = function() {
	if (this.verbose) console.log (paint.confFu (), 'variables:');
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
		var enchanted = this.isEnchantedValue (this.variables[varPath][0]);
		var logEnchanted = [];
		if ('placeholder' in enchanted) {
			logEnchanted.push ('placeholder: ' + enchanted.placeholder);
		}
		if ('default' in enchanted) {
			logEnchanted.push ('default: ' + enchanted.placeholder);
		}
		if ('variable' in enchanted) {
			logEnchanted.push ('referencing: ' + [].slice.apply (enchanted).map (function (ref) {return ref.variable}).join (", "));
		}
		console.log ("\t", paint.path(varPath), '=', paint.yellow (value === undefined ? "undefined" : value), '(' + logEnchanted.join ("; ") + ')');
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
		paint.error ((this.fixupFile? "" : "you must define fixup path, then") + " you can execute"),
		"\n"+paint.confFu ("set <variable> <value>"),
		"\nto define individual variables or",
		"\n"+paint.confFu ("edit fixup"),
		"\nto define all those vars at once by editing",
		this.fixupFile ? paint.path (this.fixupFile.shortPath ()) : "fixup file"
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

	var errors = [];

	function onLoad (err) {
		if (err) {
			self.emit.apply (self, err);
			errors.push (err);
		}
		cnt += 1;
		if (cnt == len) {
			cb (errors.length ? errors : null, config, variables, placeholders);
		}
	}

//	function onError(err) {
//		console.log('[WARNING] Level:', level, 'is not correct.\nError:', paint.error (err));
//		cb(err, config, variables, placeholders);
//	}



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
					var oops = ['error', 'include', 'file', err, basePath];
					onLoad (oops);
					return;
				}

				if (!parsed || parsed.error) {
					var oops = ['error', 'include', 'parse', (parsed ? parsed.error : null), basePath];
					onLoad(oops);
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

	!len && cb(errors.length ? errors : null, config, variables, placeholders);
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
