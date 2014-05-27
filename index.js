"use strict";

var path = require ('path');
var fs   = require ('fs');
var util = require ('util');

var EventEmitter = require ('events').EventEmitter;

var common = require ('./lib/common');

var io    = require ('./lib/fs-object');
var paint = require ('./lib/color');

paint.error  = paint.bind (paint, "red+white_bg");
paint.path   = paint.cyan.bind (paint);
paint.confFu = paint.green.bind (paint, "conf-fu");

/**

 * ConfFu is constructor for config object instance

 * @param {type} projectRoot directory where whole project is located
 * @param {type} configRoot  directory for conf-fu configuration
 * @param {type} configFile  main conf-fu file
 * @param {type} configFixupFile fixup conf-fu file
 * @param {type} instance project's current instance to detect fixup
 * @param {type} instanceFile file to read project instance
 
 examples: 
 
 load config file, expand all includes, patch config with includes using config fixup
 confFu (configFile, configFixupFile);
 
 */

var ConfFu = function (configFile, configFixupFile) {
	// in simplest case you only need two parameters:
	// configFile and configFixupFile
	
	if (!configFile) {
		throw "no config file defined, please supply configFile and configFixupFile or settings object";
	}
	
	var settings = {
		projectRoot: '',
		configRoot: '',
		configFile: '',
		configFixupFile: '',
		instance: '',
		instanceFile: ''
	};

	if (configFile.constructor === String) {
		// try to load this file
		this.configFile      = new io (configFile);
		this.configRoot      = this.configFile.parent();
		this.configFixupFile = new io (configFixupFile);
//		settings.configFixupFile = configFixupFile;
		
	} else {
		// TODO: check for object type WITH proper keys
		
		
	}
	
	// TODO: exclusive lock on config file to prevent multiple running scripts
	process.nextTick (this.loadAll.bind (this));
	
	this.checkList = {
		coreLoaded:     null,
		includesLoaded: null,
		fixupLoaded:    null,
	};
	
	this.on ('configLoaded', function () {
		this.checkList.coreLoaded = true;
		this.applyFixup ();
	});
	
	this.on ('fixupLoaded', function () {
		this.checkList.fixupLoaded = true;
		this.applyFixup ();
	});
	
	this.on ('error', this.errorHandler.bind (this));
};

util.inherits (ConfFu, EventEmitter);
module.exports = ConfFu;

ConfFu.prototype.loadAll = function () {
	this.configFile.readFile (this.onConfigRead.bind (this));
	this.configFixupFile.readFile (this.onFixupRead.bind (this));
};

ConfFu.prototype.formats = [{
	type: "json",
	check: /(\/\/\s*json[ \t\n\r]*)?[\{\[]/,
	parse: function (match, configData) {
		try {
			var config = JSON.parse (configData.toString().substr (match[0].length - 1));
			return {object: config};
		} catch (e) {
			return {object: null, error: e};
		}
	},
	stringify: JSON.stringify.bind (JSON),
}, {
	type: "ini",
	check: /^;|^\[([^\]]*)\]$/i,
	parse: function (match, configData) {
		var ini = require ('ini');
		var config = ini.parse (configData.toString());
		if (config === undefined)
			return {object: null, error: "parse error"};
		return {object: config};
	},
	stringify: function (jsObject) {
		var ini = require ('ini');
		return ini.stringify (jsObject);
	}
}];

ConfFu.prototype.errorHandler = function (eOrigin, eType, eData, eFile) {
	// origin can be config, fixup or include
	// type can be file, parser, variables
	
	var logger = console.error.bind (console);
	
	if (!this.verbose) {
		logger = function () {};
	}

	if (eType === 'parse') {
		var message = 'Config ' + eOrigin + ' (' + paint.path (eFile.path || eFile) + ') cannot be parsed:';
		if (eData === null) {
			logger (message, paint.error ('unknown format'));
			logger (
				'You can add new formats using ConfFu.prototype.formats.',
				'Currently supported formats:',
				this.formats.map (function (fmt) {return paint.path(fmt.type);}).join (', ')
			);
		} else {
			logger (message, paint.error (eData));
		}
	} else if (eType === 'file') {
		this.checkList[eOrigin+'Loaded'] = false;
		logger ("Config", eOrigin, "file error:", paint.error (eData));
		if (eOrigin !== 'fixup') {
			// TODO: maybe process.kill?
		}

	} else if (eType === 'variables') {
		this.logUnpopulated (eData);
	}
	

};

ConfFu.prototype.logUnpopulated = function(varPaths) {
	var logger = console.error.bind (console);
	
	if (!this.verbose) {
		logger = function () {};
	}

	logger ("those config variables is unpopulated:");
	for (var varPath in varPaths) {
		var value = varPaths[varPath][0];
		logger ("\t", paint.path(varPath), '=', value);
		varPaths[varPath] = value || "<#undefined>";
	}
	logger (
		"you can run",
		paint.confFu ("config set <variable> <value>"),
		"to define individual variable\nor edit",
		paint.path (this.configFixupFile.path),
		"to define all those vars at once"
	);
	// console.log (this.logUnpopulated.list);
};


ConfFu.prototype.applyFixup = function () {
	if (this.checkList.coreLoaded === null || this.checkList.fixupLoaded === null) {
		return;
	}
	// all files is loaded or failed
	if (this.configFixup) {
		common.extend (true, this.config, this.configFixup);
	}
	this.interpolateVars ();

};

ConfFu.prototype.readInstance = function () {
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

		var instance = (""+data).split (/\n/)[0];
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

ConfFu.prototype.setVariables = function (fixupVars, force) {
	var self = this;
	// ensure fixup is defined
	// TODO: migration from instance-based
	if (!this.configFixupFile) {
		console.log ('Cannot write to the fixup file with undefined instance. Please run', paint.confFu('init'));
		process.kill ();
	}

	if (!this.configFixup) {
		this.configFixup = {};
	}

	// apply patch to fixup config
	Object.keys (fixupVars).forEach (function (varPath) {
		var pathChunks = [];
		var root = self.configFixup;
		varPath.split ('.').forEach (function (chunk, index, chunks) {
			pathChunks[index] = chunk;
			var newRoot = root[chunk];
			if (index === chunks.length - 1) {
				if (force || !(chunk in root)) {
					root[chunk] = fixupVars[varPath][0] || "<#undefined>";
				}
			} else if (!newRoot) {
				root[chunk] = {};
				newRoot = root[chunk];
			}
			root = newRoot;
		});
	});

	// wrote config to the fixup file
	this.configFixupFile.writeFile (
		JSON.stringify (this.configFixup, null, "\t")
	);
};

ConfFu.prototype.parseConfig = function (configData, configFile, type) {
	var self = this;
	var result;
	this.formats.some (function (format) {
		var match = (""+configData).match (format.check);
		if (match) {
			result = format.parse (match, configData);
			result.type   = format.type;
			return true;
		}
	});
	// TODO: get actual error
	if (!result) {
		self.emit ('error', type, 'parse', null, (configFile.path || configFile));
		return {};
	}
	if (result.error) {
		self.emit ('error', type, 'parse', result.error, (configFile.path || configFile));
	}
	return result;
};

ConfFu.prototype.interpolateVars = function (error) {
	// var variables = {};
	var self = this;

	function iterateNode (node, key, depth) {
		var value = node[key];
		var fullKey = depth.join ('.');
		var match;

		if (self.variables[fullKey]) {
			self.variables[fullKey][1] = value;
		}

		if ('string' !== typeof value) {
			return;
		}

		var enchanted = self.isEnchantedValue (value);
		if (!enchanted) {
			// WTF???
			if (self.variables[fullKey]) {
				self.variables[fullKey][1] = value.toString ? value.toString() : value;
			}

			return;
		}
		if ("placeholder" in enchanted) {
			// this is a placeholder, not filled in fixup
			self.variables[fullKey] = [value];
			if (enchanted.optional) {
				self.variables[fullKey][1] = null;
				node[key] = null;
			} else if (enchanted.default) {
				self.variables[fullKey][1] = enchanted.default;
				node[key] = enchanted.default;
			}
			return;
		}
		if ("variable" in enchanted) {
			// this is a variable, we must fill it now
			// current match is a variable path
			// we must write both variable path and a key,
			// containing it to the fixup

			var varValue = self.getKeyDesc (enchanted.variable.substr (1));
			if (varValue.enchanted !== undefined) {
				if ("variable" in varValue.enchanted) {
					console.error (
						"variable value cannot contains another variables. used variable",
						paint.path(enchanted.variable),
						"which resolves to",
						paint.path (varValue.value),
						"in key",
						paint.path(fullKey)
					);
					process.kill ();
				}
				self.variables[fullKey] = [value];
			} else if (varValue.value !== undefined) {
				node[key] = common.interpolate (value, self.config, {start: '<', end: '>'});
				self.variables[fullKey] = [value, node[key]];
			} else {
				self.variables[fullKey] = [value];
			}

			return;
		}
		// this cannot happens, but i can use those checks for assertions
		if ("error" in enchanted || "include" in enchanted) {
			// throw ("this value must be populated: \"" + value + "\"");
		}
	}

	self.iterateTree (self.config, iterateNode, []);

	var unpopulatedVars = {};

	var varNames = Object.keys (self.variables);
	varNames.forEach (function (varName) {
		if (self.variables[varName][1] !== undefined) {

		} else {
			unpopulatedVars[varName] = self.variables[varName];
		}
	});

	this.setVariables (self.variables);

	if (Object.keys(unpopulatedVars).length) {
		self.emit ('error', 'config', 'variables', unpopulatedVars);
		return;
	}

	self.emit ('ready');


};

ConfFu.prototype.onFixupRead = function (err, data) {
	
	var configFixup = {};
	if (err) {
		this.emit ('error', 'fixup', 'file', err, this.configFixupFile.path);
		return;
	}

	var parsedFixup = this.parseConfig (data, this.configFixupFile, 'fixup');
	if (parsedFixup.object) {
		this.configFixup = configFixup = parsedFixup.object;
	} else {
		// process.kill ();
		return;
	}

	this.emit ('fixupLoaded');
};

ConfFu.prototype.onConfigRead = function (err, data) {

	if (err) {
		var message = "Can't access '" + this.configFile.path + "' file.";
		console.error (paint.confFu(), paint.error (message));
		// process.kill ();
		this.emit ('error', message);
		return;
	}

	var config;
	var parsed = this.parseConfig (data, this.configFile, 'core');
	if (parsed.object) {
		config = parsed.object;
	} else {
		process.kill ();
		return;
	}

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

ConfFu.prototype.iterateTree = function iterateTree (tree, cb, depth) {
	if (null == tree) {
		return;
	}

	var level = depth.length;

	var step = function (node, key, tree) {
		depth[level] = key;
		cb (tree, key, depth);
		iterateTree (node, cb, depth.slice (0));
	};

	if (Array === tree.constructor) {
		tree.forEach (step);
	} else if (Object === tree.constructor) {
		Object.keys(tree).forEach(function (key) {
			step (tree[key], key, tree);
		});
	}
};

ConfFu.prototype.getKeyDesc = function (key) {
	var result = {};
	var value = common.getByPath (key, this.config);
	result.value = value.value;
	result.enchanted = this.isEnchantedValue (result.value);
	// if value is enchanted, then it definitely a string
	if (result.enchanted && "variable" in result.enchanted) {
		result.interpolated = result.value.interpolate();
		return result;
	}
	return result;
};


ConfFu.prototype.getValue = function (key) {
	var value = common.getByPath (key, this.config).value;
	if (value === undefined) {
		return;
	}
	var enchanted = this.isEnchantedValue (value);
	// if value is enchanted, then it definitely a string
	if (enchanted && "variable" in enchanted) {
		var result = new String (value.interpolate());
		result.rawValue = value;
		return result;
	}
	return value;
};

ConfFu.prototype.isEnchantedValue = function (value) {

	var tagRe = /<(([\$\#]*)((optional|default):)?([^>]+))>/;
	var result;

	if ('string' !== typeof value) {
		return;
	}
	var check = value.match (tagRe);
	if (check) {
		if (check[2] === "$") {
			return {"variable": check[1]};
		} else if (check[2] === "#") {
			result = {"placeholder": check[1]};
			if (check[4]) {
				result[check[4]] = check[5];
			}
			return result;
		} else if (check[0].length === value.length) {
			return {"include": check[1]};
		} else {
			return {"error": true};
		}
	}
};


ConfFu.prototype.loadIncludes = function (config, level, basePath, cb) {
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
		if (cnt >= len) {
			cb(null, config, variables, placeholders);
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

				node[key] = util.clone(configCache[incPath]);
				onLoad();
				return;

			}
			
			var incPathIO = new io (incPath);
			
			incPathIO.readFile(function (err, data) {
				if (err) {
					self.emit ('error', 'include', 'file', null, (basePath.path || basePath));
					return;
				}

				var parsedInclude = self.parseConfig (data, basePath, 'fixup');
				if (parsedInclude.object) {
					self.loadIncludes(parsedInclude.object, path.join(level, DELIMITER, incPath), incPath, function(tree, includeConfig) {
						configCache[incPath] = includeConfig;

						node[key] = util.clone(configCache[incPath]);
						onLoad();
					});	
				} else {
					self.emit ('error', 'include', 'parse', parsedInclude, (basePath.path || basePath));
					// process.kill ();
					return;
				}
			});

		}
	}

	this.iterateTree(config, iterateNode, []);

//	console.log('including:', level, config);

	!len && cb(null, config, variables, placeholders);
};

ConfFu.prototype.getFilePath = function (baseDir, pathTemplate) {
	
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
