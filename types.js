module.exports = {
	int: function (meta, value) {
		if (value !== undefined && value.constructor !== Number)
			throw new Error ('not a number');
		if (value === undefined && meta.default !== undefined)
			value = meta.default;
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
						throw new Error (def + "is not a bool");
					if (m[1] !== undefined) {
						value = true;
					} else if (m[2] !== undefined) {
						value = false;
					}
				}
			}
		} else {
			if (value.constructor !== Boolean)
				throw new Error ('not a bool');
		}
		if (presentation)
			return presentation.reverse()[value*1];
		return value.toString();
	}
}
