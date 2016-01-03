module.exports = {
		"$": function (value) {
			if (typeof value === "object" && value !== null) {
				return Object.keys (value).length ? value : undefined;
			}
			if (value && value.constructor === String) {
				value = value.trim();
			}
			return value || undefined;
		},
		"*": function (value) {
			return value;
		}
	}
