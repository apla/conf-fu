module.exports = {
	json: {
		type: "json",
		parse: function (configData) {
			try {
				var string = configData.toString();
				var config = JSON.parse (string);
				return {object: config};
			} catch (e) {
				return {object: null, error: e};
			}
		},
		stringify: function (jsObject) {
			return JSON.stringify (jsObject, null, "\t");
		}
	},
	ini: {
		type: "ini",
		// check: /^;|^\[([^\]]*)\]$/mi,
		parse: function (configData) {
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
	}
}