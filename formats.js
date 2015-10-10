(function(mod) {
	if (typeof exports == "object" && typeof module == "object") // CommonJS
		module.exports = mod();
	else if (typeof define == "function" && define.amd) // AMD
		return define([], mod);
	else // Plain browser env
		this.ConfFuFormats = mod();
})(function() {

return {
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
	},
	yml: {
		type: 'yaml',
		parse: function (configData) {
			var yaml = require ('js-yaml');
			var config;
			try {
				config = yaml.safeLoad (configData.toString(), {
//					filename (default: null) - string to be used as a file path in error/warning messages.
//					strict (default - false) makes the loader to throw errors instead of warnings.
//					HATE YAML
//					when I define a schema, I'm getting TypeError: Cannot read property 'length' of undefined
//					schema: "JSON_SCHEMA"
				});
			} catch (e) {
				return {object: null, error: e};
			}
			return {object: config};
		},
		stringify: function (jsObject) {
			var yaml = require ('js-yaml');
			return yaml.safeDump (jsObject, {
//				indent (default: 2) - indentation width to use (in spaces).
//				flowLevel (default: -1) - specifies level of nesting, when to switch from block to flow style for collections. -1 means block style everwhere
//				styles - "tag" => "style" map. Each tag may have own set of styles.
				skipInvalid: true,
//				schema: "JSON_SCHEMA"
			});
		}
	}
}
});
