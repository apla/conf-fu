var path   = require ('path');
var fs     = require ('fs');
var assert = require ('assert');

var confFu     = require ('../index');
var confFuPath = require.resolve('../index');

var baseName = path.basename (__filename, path.extname (__filename));
var configDir = path.join (__dirname, baseName);

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

describe (baseName+" basic functions", function () {

	it ("is empty", function () {
		assert (confFu.isEmpty ({}));
		assert (confFu.isEmpty ([]));
		assert (confFu.isEmpty (""));
		assert (confFu.isEmpty (0));
		assert (confFu.isEmpty (null));
		assert (confFu.isEmpty (undefined));
	});

});


describe (baseName+" external usage", function () {

	it ("with include enchantment", function () {
		var enchanted = confFu.prototype.isEnchantedValue.call ({}, "<<include>>");
		return "include" in enchanted;
	});

	it ("with variable enchantment", function () {
		var enchanted = confFu.prototype.isEnchantedValue.call ({}, "<*db.mongo.port>");
		assert ("variable" in enchanted);
		var value = enchanted.interpolated ({db: {mongo: {port: 123}}});
		assert (value === 123);
	});

	it ("with nothing to enchant", function () {
		var enchanted = confFu.prototype.isEnchantedValue.call ({}, 345);
		return !enchanted;
	});

});

describe (baseName+" parse string", function () {

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

	var customMarks = {start: "{{", end: "}}"};

	it ("with include enchantment and custom marks", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("{{<include>}}", customMarks);
		return "include" in enchanted;
	});
	it ("with variable enchantment and custom marks", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("{{$db.mongo.port}}", customMarks);
		return "variable" in enchanted;
	});

	it ("with placeholder enchantment and custom marks", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("{{#placeholder}}", customMarks);
		return "placeholder" in enchanted;
	});
	it ("with placeholder default enchantment and custom marks", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("{{#default:12345}}", customMarks);
		return "placeholder" in enchanted;
	});
	it ("with placeholder optional enchantment and custom marks", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("{{#optional:placeholder}}", customMarks);
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

describe (baseName+" format string", function () {

	var data = {
		http_host: 12345,
		http_domain: "example.net",
		http_port: 808080,
		db_tcp_sock: false,
		object: {a: "b"},
		emptyObject: {}
	};

	it ("raw int", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$http_host>");
		var interpolated = enchanted.interpolated (data);
		// ensure int is real int, not within string
		assert (interpolated.constructor === Number);
		return parseInt (interpolated) === interpolated;
	});
	it ("object", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$object>");
		var interpolated = enchanted.interpolated (data);
		assert (interpolated.constructor === Object);
		assert (interpolated.a === "b");
		return interpolated.a;
	});
	it ("empty object", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$emptyObject>");
		var interpolated = enchanted.interpolated (data);
		assert (interpolated === undefined);
		return !interpolated;
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

	it ("string as int", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$int:http_domain>");
		var interpolated = enchanted.interpolated (data);
		assert (interpolated === undefined);
		assert ("error" in enchanted);
//		console.log (interpolated, enchanted);
		return;
	});
	it ("int with default", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$int:http_port=8080>");
		var interpolated = enchanted.interpolated (data);
		assert (interpolated === 808080);
		return;
	});
	it ("int with default and no value in dict", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$int:other_port=8051>");
		var interpolated = enchanted.interpolated (data);
		assert (interpolated.constructor === Number);
		assert (interpolated === 8051); // should be int, not string
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
	it ("bool with wrong type", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$bool:http_host>");
		var interpolated = enchanted.interpolated (data);
		// console.log (enchanted);
		assert (interpolated === undefined);
	});
	it ("bool without value", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$bool:service_port>");
		var interpolated = enchanted.interpolated (data);
		// console.log (enchanted);
		assert (interpolated === undefined);
	});
	it ("bool with default", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$bool:some_option=true>");
		assert (enchanted[0].type === 'bool');
		assert (enchanted[0].default === 'true');
		var interpolated = enchanted.interpolated (data);
		assert (interpolated === true);
		enchanted = confFu.prototype.isEnchantedValue ("<*bool:some_option=false>");
		assert (enchanted[0].type === 'bool');
		assert (enchanted[0].default === 'false');
		interpolated = enchanted.interpolated (data);
		// console.log (interpolated, interpolated.constructor);
		assert (interpolated === false);
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
	it ("bool default interpolated true", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$bool(on|off):xxx=on>");
		var interpolated = enchanted.interpolated (data);
		assert (interpolated === 'on');
		return "variable" in enchanted;
	});
	it ("bool default interpolated false", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$bool(on|off):xxx=off>");
		var interpolated = enchanted.interpolated (data);
		assert (interpolated === 'off');
		return "variable" in enchanted;
	});
	it ("bool default interpolated undefined", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$bool(on|off):xxx=yyy>");
		var interpolated = enchanted.interpolated (data);
		assert (interpolated === undefined);
		return "variable" in enchanted;
	});
	it ("string is fine with any data type", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$string:http_port>");
		assert (enchanted[0].type === 'string');
		var interpolated = enchanted.interpolated (data);
		assert (interpolated === "808080");
		return "variable" in enchanted;
	});
	it ("string with default", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$string:strstr=222>");
		assert (enchanted[0].type === 'string');
		var interpolated = enchanted.interpolated (data);
		assert (interpolated === "222");
		return "variable" in enchanted;
	});
	it ("string with incompatible data: object", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$string:object>");
		assert (enchanted[0].type === 'string');
		var interpolated = enchanted.interpolated (data);
		assert (interpolated === undefined);
		return "variable" in enchanted;
	});
	it ("quoted string", function () {
		var enchanted = confFu.prototype.isEnchantedValue ("<$string(\"\"):http_domain>");
		assert (enchanted[0].type === 'string');
		var interpolated = enchanted.interpolated (data);
		console.log (interpolated);
		return "variable" in enchanted;
	});
	it ("custom marks", function () {
		confFu.prototype.operations["&"] = function (value) {return value;}
		var enchanted = confFu.prototype.isEnchantedValue (
			"{{&string(\"\"):http_domain}}", {
				end: "}}",
				start: "{{",
				safe: "&"
			});
		assert (enchanted[0].type === 'string');
		return "variable" in enchanted;
	});
	it ("custom types", function () {
		// types will be passed automatically in conf-fu
		confFu.prototype.types._jsonFor_test = function (meta, value) {
			return JSON.stringify (value, null, meta.typeArgs || "");
		};
		var enchanted = confFu.prototype.isEnchantedValue ("<$_jsonFor_test(\t):toJson>");
		var interpolated = enchanted.interpolated ({
			toJson: {a: 1, b: "$%^"}
		});
		// console.log (interpolated);
		assert (interpolated.constructor === String);
		var data = JSON.parse (interpolated);
		assert (data.a === 1);
		assert (data.b === "$%^");
		return true;
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
