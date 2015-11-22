(function(mod) {
	if (typeof exports == "object" && typeof module == "object") // CommonJS
		module.exports = mod();
	else if (typeof define == "function" && define.amd) // AMD
		return define([], mod);
	else // Plain browser env
		this.ConfFuTypes = mod();
})(function() {

function incompatibleType (type) {

}

return {
	incompatibleType: incompatibleType,
	int: function (meta, value) {
		if (value !== undefined && value.constructor !== Number)
			return incompatibleType;
		if (value === undefined && meta.default !== undefined)
			value = parseInt (meta.default);
		return value;
	},
	bool: function (meta, value) {
		var presentation;
		// bool can be represented as string, so argString is a "true|false" string
		if (meta.typeArgs)
			presentation = meta.typeArgs.split ("|");
		if (value === undefined) {
			if (value === undefined && meta.default !== undefined) {
				var def = meta.default;
				if (def.match (/^true$/i)) {
					value = true;
				} else if (def.match (/^false$/i)) {
					value = false;
				} else {
					var m = def.match (new RegExp ("^"+meta.typeArgs.replace (/[\|,:]/, ")|("+")$", "i")));
					if (!m)
						return incompatibleType;
					if (m[1] !== undefined) {
						value = true;
					} else if (m[2] !== undefined) {
						value = false;
					}
				}
			}
		} else {
			if (value.constructor !== Boolean)
				return incompatibleType;
		}
		if (presentation)
			return presentation.reverse()[value*1];
		return value;
	},
	string: function (meta, value) {
		// string is fine with all simple data types, but not with arrays and objects
		if (value !== undefined && typeof value === 'object')
			return incompatibleType;
		if (value === undefined && meta.default !== undefined)
			value = meta.default;
		// TODO: add a string quote, test already in 03-expand
		// typeArgs for string is a quoting preference
//		if (meta.typeArgs === '""')
//			value
		return value.toString();
	}
}

});
