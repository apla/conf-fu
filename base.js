/**
 * conf-fu constructor
 * @param {object} options initialization options
 */
var ConfFu = function (options) {

	this.config = options.config;
	this.fixup  = options.fixup;

	this.variables    = {};
	this.placeholders = {};
	this.aliens       = {};

	this.setupVariables = options.setupVariables || {};

	this.marks = options.marks;
	if (!options || !options.config) {
		this.ready = false;
		this.error = "no options defined, please supply config and fixup";
		return;
	}


	this.ready = this.applyFixup ();
};

ConfFu.prototype.formats    = require ('./formats');
ConfFu.prototype.types      = require ('./types');
ConfFu.prototype.operations = require ('./operations');

module.exports = ConfFu;

var jqextend = function () {
	var hasOwnProperty = Object.prototype.hasOwnProperty;

	// copy reference to target object
	var target = arguments[0] || {}, i = 1, length = arguments.length, deep = false, options, name, src, copy;
	// Handle a deep copy situation
	if (typeof target === "boolean") {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	}
	// Handle case when target is a string or something (possible in deep copy)
	if (typeof target !== "object" && typeof target !== 'function')
		target = {};
	var isPlainObject = function(obj) {
		// Must be an Object.
		// Because of IE, we also have to check the presence of the constructor property.
		// Make sure that DOM nodes and window objects don't pass through, as well
		if (!obj || {}.toString.call(obj).slice(8, -1) !== "Object" || obj.nodeType || obj.setInterval)
			return false;
		var has_own_constructor = hasOwnProperty.call(obj, "constructor");
		var has_is_property_of_method = hasOwnProperty.call(obj.constructor.prototype, "isPrototypeOf");
		// Not own constructor property must be Object
		if (obj.constructor && !has_own_constructor && !has_is_property_of_method)
			return false;
		// Own properties are enumerated firstly, so to speed up,
		// if last one is own, then all properties are own.
		var last_key;
		for (var key in obj)
			last_key = key;
		return typeof last_key === "undefined" || hasOwnProperty.call(obj, last_key);
	};
	for (; i < length; i++) {
		// Only deal with non-null/undefined values
		if ((options = arguments[i]) !== null) {
			// Extend the base object
			for (name in options) {
				src = target[name];
				copy = options[name];
				// Prevent never-ending loop
				if (target === copy)
					continue;
				// Recurse if we're merging object literal values or arrays
				if (deep && copy && (isPlainObject(copy) || Array.isArray(copy))) {
					var clone = src && (isPlainObject(src) || Array.isArray(src)) ? src : Array.isArray(copy) ? [] : {};
					// Never move original objects, clone them
					target[name] = jqextend(deep, clone, copy);
					// Don't bring in undefined values
				} else if (typeof copy !== "undefined")
					target[name] = copy;
			}
		}
	}
	// Return the modified object
	return target;
}

var clone  = ConfFu.clone  = function (value) {return JSON.parse (JSON.stringify (value))};
var extend = ConfFu.extend = jqextend.bind (ConfFu, true);

ConfFu.isEmpty = function isEmpty (value) {
	return ConfFu.prototype.operations['='] (value) ? false : true;
}

var pathToVal = ConfFu.pathToVal = function (dict, path, value, method) {
	var chunks = 'string' == typeof path ? path.split((this && this.marks && this.marks.path) || '.') : path;
	var chunk = chunks[0];
	var rest = chunks.slice(1);
	var oldValue = dict[chunk];
	if (chunks.length == 1) {
		if (value !== undefined) {
			if (method !== undefined) {
				method(value, dict, chunk);
			} else {
				dict[chunk] = value;
			}
		}
		return oldValue;
	} else if (oldValue === undefined) {
		return;
	}
	return pathToVal(dict[chunk], rest, value, method);
};


ConfFu.prototype.applyFixup = function () {
	// all files is loaded or failed
	if (this.fixup) {
		// TODO: find orphan variables from fixup
		extend (this.config, this.fixup);
	}

	return this.interpolateVars ();
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

		var enchanted = self.isEnchantedValue (value, self.marks, self.types);
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

			var interpolated = enchanted.interpolated (self.config);
			//			console.log ('%%%%%%%%%%%%%%%%%%%%%%%', enchanted, interpolated);
			if (interpolated === undefined) {
				// erroneous fields is in enchanted.failure
				self.variables[fullKey] = [value];
			} else {
				node[key] = interpolated;
				self.variables[fullKey] = [value, node[key]];
			}
			return;
		}
		// this cannot happens, but i can use those checks for assertions
		if ("error" in enchanted || "include" in enchanted) {
			// throw ("this value must be populated: \"" + value + "\"");
		}
	}

	self.iterateTree (self.config, iterateNode, []);

	var unpopulatedVars = this.unpopulatedVariables ();

	var allVars = extend ({}, this.variables, this.setupVariables);

	this.setVariables (allVars);

	if (!unpopulatedVars) return;

	if (Object.keys(unpopulatedVars).length) {
		return;
	}

	return true;
};

ConfFu.prototype.unpopulatedVariables = function (fixupVars, force) {
	var unpopulatedVars = {};
	if (!this.variables) return;
	var varNames = Object.keys (this.variables);
	var self = this;
	varNames.forEach (function (varName) {
		if (self.variables[varName][1] === undefined && !(varName in self.setupVariables)) {
			unpopulatedVars[varName] = self.variables[varName];
		}
	});
	return unpopulatedVars;
}

ConfFu.prototype.setVariables = function (fixupVars, force, undef) {
	var self = this;

	var changed = false;

	if (!this.fixup) {
		this.fixup = {};
		changed = 1;
	}

	// apply patch to fixup config
	Object.keys (fixupVars).forEach (function (varPath) {
		var pathChunks = [];
		var root = self.fixup;
		varPath.split ('.').forEach (function (chunk, index, chunks) {
			pathChunks[index] = chunk;
			var newRoot = root[chunk];
			if (index === chunks.length - 1) {
				var value = (fixupVars[varPath] && fixupVars[varPath].constructor === Array) ? fixupVars[varPath][0] : fixupVars[varPath] || undef;
				if (!(chunk in root) || (root[chunk] !== value && force)) {
					changed = 2;
					// console.log (varPath, root[chunk], '=>', value);
				}
				if (force || !(chunk in root)) {
					root[chunk] = value;
				}
			} else if (!newRoot) {
				changed = 3;
				root[chunk] = {};
				newRoot = root[chunk];
			}
			root = newRoot;
		});
	});

	return changed;
};

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

function interpolated (types, operations, dictionary) {
	var result = this;

	delete result.error;

	var toConcat = [];
	for (var k = 0; k < result.length; k++) {
		var theVar = result[k];
		if (theVar.before)
			toConcat.push (theVar.before);
		var interpolatedVar = pathToVal (dictionary, theVar.variable);
		if (types[theVar.type]) {
			interpolatedVar = types[theVar.type] (theVar, interpolatedVar);
			if (interpolatedVar === types.incompatibleType) {
				result.error = theVar.variable+' type ('+theVar.type+') is incompatible with value ' + interpolatedVar;
				return;
			}
		}
		interpolatedVar = operations[theVar.operation] (interpolatedVar);
		if (interpolatedVar === undefined) {
			result.error = theVar.variable+' is not defined';
			return;
		}
		toConcat.push (interpolatedVar);
	}

	if (result.after)
		toConcat.push (result.after);

	if (toConcat.length === 1)
		return toConcat[0];

	return toConcat.join ("");
}

/**
 * search for enchantments
 * @param   {Object} value         value to search
 * @param   {Object} marksOverride custom marks instead of default ones: start: '<', end: '>', path: '.', placeholder: '#'
 * @param   {Object} types         custom types, see example at types.js
 * @param   {Object} operations    custom operations, see operations.js
 * @returns {Object} enchantments or undefined. TODO: explain variable/placeholder/include/intepolated
 */
ConfFu.prototype.isEnchantedValue = function (value, marksOverride, types, operations) {

	var marks = {
		start: '<',
		end: '>',
		path: '.',
		placeholder: '#',
		defaultValue: '=|', // this mark is used inside of regexp character set, so it is means '=' OR '|'
	};
	marksOverride = marksOverride || this.marks || {};
	extend (marks, marksOverride);

	types = types || this.types || {};
	operations = operations || this.operations || {"*": function (value) {return value}};

	var vartypesRe = Object.keys (types).join ("|") || "\\w+";
	var variableReg = new RegExp (
		marks.start
		+"(["+Object.keys (operations)+"])((("+vartypesRe+")(\\(([^\)]*)\\))?:)?([^"+marks.end+marks.defaultValue+"]+)(["+marks.defaultValue+"]([^"+marks.end+"]*))?)"
		+marks.end,
	"ig");
	var placeholderRe = new RegExp ("^"+marks.start+"((\#)((optional|default):)?([^"+marks.end+"]+))"+marks.end+"$", "i");
	var includeRe     = new RegExp ("^"+marks.start+"<([^<>]+)>"+marks.end+"$", "i");

	var self = this;

	var result;

	if ('string' !== typeof value) {
		return;
	}

	var matchData;
	var lastIdx = 0;
	while ((matchData = variableReg.exec (value)) !== null) {
		if (!result)
			result = {length: 0, asVariables: {}};
//		matchData.index
		var before = (matchData.index === lastIdx === 0)? null : value.substring (
			lastIdx,
			matchData.index
		);
		lastIdx = variableReg.lastIndex;
		result[result.length] = {
			operation: matchData[1],
			variable:  matchData[7],
			type:      matchData[4],
			typeArgs:  matchData[6],
			default:   matchData[9],
			lastIdx:   variableReg.lastIndex,
			before:    before
		};
		result.asVariables[matchData[7]] = [];
		result.variable = true;
		result.length ++;
	}

	if (result && result.length) {
		result.after = (value.length === lastIdx + 1) ? null : value.substring (lastIdx);
		result.interpolated = interpolated.bind (result, types, operations);
		return result;
	}

	var check;
	if (check = value.match (placeholderRe)) {
		result = {"placeholder": check[5]};
		if (check[4]) {
			result[check[4]] = check[5];
		}
		return result;
	} else if (check = value.match (includeRe)) {
		return {"include": check[1]};
	}
};
