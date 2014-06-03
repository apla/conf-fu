var path   = require ('path');
var fs     = require ('fs');
var assert = require ('assert');

var confFu     = require ('../index');
var confFuPath = require.resolve('../index');

var assets = path.basename (__filename, path.extname (__filename));
var configDir = path.join (__dirname, assets);

var globalVerbose = process.env.VERBOSE || false;

//var regexp0 = /<(([\$\#]*)((optional|default):)*([^>]+))>/;
//console.log ("<$optional:db.mongo.port>".match (regexp0));
//console.log ("<filename>".match (regexp0));
//var regexp1 = /<((\$)((int|quoted|bool):)?([^>]+))>/i;
//var regexp2 = /<((\#)((optional|default):)?([^>]+))>/i;
//var regexp3 = /^<<([^<>]+)>>$/i;
//console.log ("<$int:db.mongo.port>".match (regexp1));
//console.log ("<#default:12345>".match (regexp2));
//console.log ("<<filename>>".match (regexp3));


describe ("parse string", function () {

	it ("with include enchantment", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<<include>>");
		return "include" in enchanted;
	});
	it ("with variable enchantment", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$db.mongo.port>");
		return "variable" in enchanted;
	});

	it ("with placeholder enchantment", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<#placeholder>");
		return "placeholder" in enchanted;
	});
	it ("with placeholder default enchantment", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<#default:12345>");
		return "placeholder" in enchanted;
	});
	it ("with placeholder optional enchantment", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<#optional:placeholder>");
		return "placeholder" in enchanted;
	});
	it ("with int variable enchantment", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$int:http_host>");
		assert (enchanted.type === 'int');
		return "variable" in enchanted;
	});
	it ("with boolean variable enchantment", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$bool:have_db>");
		assert (enchanted.type === 'bool');
		return "variable" in enchanted;
	});

});

describe ("format string", function () {

	var data = {
		http_host: 12345,
		http_domain: "example.net",
		have_db: false,
	};

	it ("raw int", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$http_host>");
		var interpolated = enchanted.interpolated (data);
		return parseInt (interpolated) === interpolated;
	});
	it.skip ("string as int", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$int:http_domain>");
		var interpolated = enchanted.interpolated (data);
		assert (interpolated === undefined);
		console.log (interpolated, enchanted);
		return;
	});
	it.skip ("bool", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$bool:have_db>");
		assert (enchanted.type === 'bool');
		return "variable" in enchanted;
	});
	it.skip ("bool with custom status", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$bool(on|off):have_db>");
		assert (enchanted.type === 'bool');
		return "variable" in enchanted;
	});
	it.skip ("bool with custom status and default", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$bool(on|off):have_db=off>");
		assert (enchanted.type === 'bool');
		return "variable" in enchanted;
	});
	it.skip ("quoted string", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$string(\"\"):http_domain>");
		assert (enchanted.type === 'bool');
		return "variable" in enchanted;
	});

});

//		if ("placeholder" in enchanted) {
//			if (enchanted.optional) {
//			} else if (enchanted.default) {
//			}
//		} else if ("variable" in enchanted) {
//		} else if ("error" in enchanted || "include" in enchanted) {
//
//		}
