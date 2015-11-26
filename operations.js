module.exports = {
		"$": function (value) {
			if (typeof value === "object") {
				return Object.keys (value).length ? value : undefined;
			}
			return value || undefined;
		},
		"*": function (value) {
			return value;
		}
	}
