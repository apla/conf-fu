(function(mod) {
	if (typeof exports == "object" && typeof module == "object") // CommonJS
		module.exports = mod();
	else if (typeof define == "function" && define.amd) // AMD
		return define([], mod);
	else // Plain browser env
		this.ConfFuOperations = mod();
})(function() {

	return {
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

});
