var ConfFu = function (options) {
	if (!options || !options.config) {
		throw "no options defined, please supply config and fixup";
	}

	this.config = options.config;
	this.fixup  = options.fixup;

	this.variables    = {};
	this.placeholders = {};
	this.aliens       = {};

	this.setupVariables = options.setupVariables || {};

	this.ready = this.applyFixup ();
};

ConfFu.prototype.formats = require ('./formats');

ConfFu.prototype.types = require ('./types');

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

var clone  = ConfFu.clone  = jqextend.bind (ConfFu, true, {});
var extend = ConfFu.extend = jqextend.bind (ConfFu, true);

var PLATFORM_NATIVE_TYPES = {
	// Buffer seems to be the only custom type in the Node core
	'Buffer': true
};

var lookUpCustomType = function (obj) {
	var name = obj && obj.constructor && obj.constructor.name;
	if (name && name in PLATFORM_NATIVE_TYPES) {
		return name;
	}
};
/**
 * Get the type of any object.
 * Usage:
 *     Object.typeOf([ 1, 2, 3 ]);    // 'Array'
 *     Object.typeOf(null);           // 'Null'
 *     Object.typeOf(new Buffer('')); // 'Buffer'
 */
var typeOf = function (obj) {
	return lookUpCustomType(obj) ||
		Object.prototype.toString.call(obj).slice(8, -1);
};

/**
 * Safe and universal type check.
 * Usage:
 *     Object.is('Number', 4);            // true
 *     Object.is('Undefined', undefined); // true
 */
var is = function (type, obj) {
	return type == typeOf(obj);
};

function isEmpty(obj) {
	var type = typeOf(obj);
	return (
		('Undefined' == type)                              ||
		('Null'      == type)                              ||
		('Boolean'   == type && false === obj)             ||
		('Number'    == type && (0 === obj || isNaN(obj))) ||
		('String'    == type && 0 == obj.length)           ||
		('Array'     == type && 0 == obj.length)           ||
		('Object'    == type && 0 == Object.keys(obj).length)
	);
}

var pathToVal = module.exports.pathToVal = function (dict, path, value, method) {
	var chunks = 'string' == typeof path ? path.split('.') : path;
	var chunk = chunks[0];
	var rest = chunks.slice(1);
	if (chunks.length == 1) {
		var oldValue = dict[chunk];
		if (value !== undefined) {
			if (method !== undefined) {
				method(value, dict, chunk);
			} else {
				dict[chunk] = value;
			}
		}
		return oldValue;
	}
	return pathToVal(dict[chunk], rest, value, method);
};


/**

 * interpolate variables inside string

 * @param {string} str string to interpolate

 * @param {Object} dict dictonary of variables

 * @param {Object} marks marks of variables in string, by default: {start: '{', end: '}', path: '.', typeSafe: '$', typeRaw: '*'}

 * @param {type} mustThrow must throw on interpolation error or just return undef

 */

var interpolate = ConfFu.interpolate = function (str, dict, marks, mustThrow) {
	if (!marks)
		marks = {};
	marks.start    = marks.start || '{';
	marks.end      = marks.end   || '}';
	marks.path     = marks.path  || '.';
	marks.typeSafe = marks.typeSafe || '$';
	marks.typeRaw  = marks.typeRaw  || '*';

	// TODO: escape character range delims
	var re = new RegExp([
		'[', marks.start, ']',
		'([', marks.typeSafe, marks.typeRaw, '])',
		'([^', marks.end, ']+)',
		'[', marks.end, ']'
	].join(''), 'g');

	var startRe = new RegExp([
		'[', marks.start, ']',
		'([', marks.typeSafe, marks.typeRaw, '])'
	].join(''), 'g');

	var values = [];
	var fields = {};

	var replacedStr = str.replace(re, function (_, varType, varPath) {
		var value;
		if (varPath.indexOf(marks.path) > -1) {
			try {
				value = pathToVal(dict, varPath);
			} catch (e) {
			}
		} else {
			value = dict[varPath];
		}

		if (isEmpty(value) && varType == marks.typeSafe) {
			value = undefined;
		}

		values.push(value);
		fields[varPath] = value;

		return value;
	});

	if (values.some(function (v) { return (typeof v === "undefined"); })) {
		if (mustThrow === true)
			throw fields;
		return undefined;
	}

	if (values.length === 1 && (values[0] + '') === replacedStr) {
		return values[0];
	}

	return replacedStr;
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

	var allVars = extend ({}, this.setupVariables, this.variables);

	this.setVariables (allVars);

	if (Object.keys(unpopulatedVars).length) {
		return;
	}

	return true;
};

ConfFu.prototype.unpopulatedVariables = function (fixupVars, force) {
	var unpopulatedVars = {};
	var varNames = Object.keys (this.variables);
	var self = this;
	varNames.forEach (function (varName) {
		if (self.variables[varName][1] === undefined && !(varName in self.setupVariables)) {
			unpopulatedVars[varName] = self.variables[varName];
		}
	});
	return unpopulatedVars;
}

ConfFu.prototype.setVariables = function (fixupVars, force) {
	var self = this;
	// ensure fixup is defined
	// TODO: migration from instance-based

	if (!this.fixup) {
		this.fixup = {};
	}

	// apply patch to fixup config
	Object.keys (fixupVars).forEach (function (varPath) {
		var pathChunks = [];
		var root = self.fixup;
		varPath.split ('.').forEach (function (chunk, index, chunks) {
			pathChunks[index] = chunk;
			var newRoot = root[chunk];
			if (index === chunks.length - 1) {
				if (force || !(chunk in root)) {
					root[chunk] = (fixupVars[varPath] && fixupVars[varPath].constructor === Array) ? fixupVars[varPath][0] : fixupVars[varPath] || "<#undefined>";
				}
			} else if (!newRoot) {
				root[chunk] = {};
				newRoot = root[chunk];
			}
			root = newRoot;
		});
	});

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


ConfFu.prototype.isEnchantedValue = function (value) {

	var tagRe = /<(([\$\#]*)((optional|default):)*([^>]+))>/;
	var variableReg   = /<((\$)((int|string|bool)(\(([^\)]*)\))?:)?([^>=]+)(=([^>]*))?)>/ig;
	var placeholderRe = /^<((\#)((optional|default):)?([^>]+))>$/i;
	var includeRe     = /^<<([^<>]+)>>$/i;

	var self = this;

	var result;

	if ('string' !== typeof value) {
		return;
	}

	var self = this;

	var matchData;
	var lastIdx = 0;
	while ((matchData = variableReg.exec (value)) !== null) {
		if (!result)
			result = {length: 0};
//		matchData.index
		var before = (matchData.index === lastIdx === 0)? null : value.substring (
			lastIdx,
			matchData.index
		);
		lastIdx = variableReg.lastIndex;
		result[result.length] = {
			variable: matchData[7],
			type:     matchData[4],
			typeArgs: matchData[6],
			default: matchData[9],
			lastIdx:  variableReg.lastIndex,
			before:   before
		};
		result.variable = true;
		// WTF support legacy code
		if (result.length === 0) {
			result.variable = result[0].variable;
			result.type     = result[0].type;
			result.typeArgs = result[0].typeArgs;
			result.default = result[0].default;
		}
		result.length ++;
	}

	if (result && result.length) {
		var after = (value.length === lastIdx + 1) ? null : value.substring (lastIdx);
		result.interpolated = function (dictionary) {

			try {
				var toConcat = [];
				for (var k = 0; k < result.length; k++) {
					var theVar = result[k];
					if (theVar.before)
						toConcat.push (theVar.before);
					var interpolatedVar = pathToVal (dictionary, theVar.variable);
					if (self.types[theVar.type])
						interpolatedVar = self.types[theVar.type] (theVar, interpolatedVar);
					toConcat.push (interpolatedVar);
				}
				if (after)
					toConcat.push (after);
				if (toConcat.length === 1)
					return toConcat[0];
				return toConcat.join ("");
			} catch (e) {
				result.failure = e;
				return undefined;
			}
		}

		if (0) {
			var toConcat = [];
			for (var k = 0; k < result.length; k++) {
				if (result[k].before !== "")
					toConcat.push (result[k].before);
				toConcat.push (result[k].variable);
			}
			if (after)
				toConcat.push (after);
			if (toConcat.length === 1)
				console.log (toConcat[0]);
			console.log (toConcat);

		}
		return result;
	}

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
