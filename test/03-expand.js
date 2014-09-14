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
//var regexp1 = /<((\$)((int|quoted|bool)(\([^\)]*\))?:)?([^>=]+)(=[^>]*)?)>/i;
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
		assert (enchanted[0].type === 'int');
		return "variable" in enchanted;
	});
	it ("with boolean variable enchantment", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$bool:have_db>");
		assert (enchanted[0].type === 'bool');
		return "variable" in enchanted;
	});

});

describe ("format string", function () {

	var data = {
		http_host: 12345,
		http_domain: "example.net",
		http_port: 808080,
		db_tcp_sock: false,
	};

	it ("raw int", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$http_host>");
		var interpolated = enchanted.interpolated (data);
		// ensure int is real int, not within string
		assert (interpolated.constructor === Number);
		return parseInt (interpolated) === interpolated;
	});
	it ("multiple values", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$http_domain>:<$http_port>");
		var interpolated = enchanted.interpolated (data);
		assert (enchanted.length === 2);
		assert (interpolated === (data.http_domain + ':' + data.http_port));
		return;
	});
	it ("multiple values 2", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("one<$http_domain>two<$http_port>three");
		var interpolated = enchanted.interpolated (data);
		assert (enchanted.length === 2);
		assert (interpolated === ("one"+data.http_domain + 'two' + data.http_port+"three"));
		return;
	});

	it.skip ("string as int", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$int:http_domain>");
		var interpolated = enchanted.interpolated (data);
		assert (interpolated === undefined);
		console.log (interpolated, enchanted);
		return;
	});
	it ("bool", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$bool:db_tcp_sock>");
		assert (enchanted[0].type === 'bool');
		return "variable" in enchanted;
	});
	it ("bool with custom status", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$bool(on|off):db_tcp_sock>");
		assert (enchanted[0].type === 'bool');
		return "variable" in enchanted;
	});
	it ("bool with custom status and default", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$bool(on|off):db_tcp_sock=off>");
		assert (enchanted[0].type === 'bool');
		assert (enchanted[0].default === 'off');
		return "variable" in enchanted;
	});
	it ("bool with custom status and default interpolated", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$bool(on|off):db_tcp_sock=off>");
		var interpolated = enchanted.interpolated (data);
		assert (interpolated === 'off');
		return "variable" in enchanted;
	});
	it.skip ("bool default interpolated", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$bool(on|off):db_unix_sock=on>");
		var interpolated = enchanted.interpolated (data);
		assert (interpolated === 'off');
		return "variable" in enchanted;
	});
	it ("quoted string", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$string(\"\"):http_domain>");
		assert (enchanted[0].type === 'string');
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
