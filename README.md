conf-fu
==========

Simple configuration module to handle complex problems

Install
-------

npm install -g conf-fu

Synopsis
--------

```javascript

var ConfFu = require ('conf-fu');

// init from files
var config = new ConfFu ({
   configFile: path.join (configDir, 'index.json'),
   fixupFile:  path.join (configDir, 'fixup.json')
});

config.verbose = globalVerbose || false;

config.on ('ready', function () {
   done();
});

config.on ('error', function (eOrigin, eType, eData, eFile) {
   assert (false, 'wrong config');
});

// init from structures
var config = new ConfFu ({
   config: {a: {b: {c: "<#who knows>"}}, x: true}
});

```

Goals
----------

1. Easy to use

   Common formats, you can set up a location of configuration files.
If you already have one, you do not need to change files location for each project,
you can just point this location (set up environment) for all needed projects.

2. Scalable

   Hierarchical, any section can live in a separate file, easy access to frequently changing sections.

3. Easy deployment

   Configuration is actually is splitted to the project configuration and the instance fixup.
You can have as many fixups as you want, not only development and production.

4. Persistent

   Current configuration snapshot is always on disk and in vcs. No code allowed within configuration.
Tools never change project config, only fixup allowed to change.

Those is not acceptable:

1. `require ('config.json')` — 1, 2, 3;
2. nconf - 4 (require code to load includes)
3. node-convict - 2 (no access to frequently changing sections), 3 (no separation beween project config and instance fixup)
4. dotenv - 2, 4 (recommended not to commit config)
5. node-config - 1 (cannot change location), 4 (instance name not stored on disk)

Configuration file
---------------

Configuration format when parsed must be presented with tree or key-value structure.

Each string can be basic or enchanted. `conf-fu` supports those enchantments:

1. variables

   examples:

    * `<$db.mongo.collection>` —  linked to the other value in configuration
    * `<$bool(on|off):db_unix_sock=on>` — variable with type and default value
    * `<$http_domain>:<$http_port>` — string concatenation

2. placeholders

   examples:
   
    * `<#placeholder>` — just a placeholder, need to be fullfilled
    * `<#optional:placeholder>` — you can omit this value in fixup
    * `<#default:127.0.0.1>` — you can omit this value in fixup and default value will be used
    
3. includes

   examples:
   
   * `<<filename>>` — parsed content from filename need to be inserted into that node

Usage
---------------

You can use `conf-fu` standalone, integrate within project or use it in browser.

####node.js in standalone mode 

conf-fu configuration is located within `.conf-fu` directory in project root.
Main configuration file named `project.json`, fixup directories located at same level as the `project.json` file.

1. `project.json` file is loaded and parsed. `json`, `ini` and `yaml` formats supported, new formats can be added easily;
2. `project.json` contents is scanned for includes in form `"<include-file-name>"`;
3. when all includes is loaded, config tree is scanned for variables (`"<$config.path.variable>"`) and placeholders (`"<#please fix me>"`, `"<#optional:please fix me>"`, `"<#default:127.0.0.1>"`);
4. `fixup.json` file loaded and checked, whether all variables and placeholders fulfilled;
5. if resulting config is fulfilled, `conf-fu` emits `ready` event; otherwise, `error` event emitted.

#####Environment variables to drive config

required:

 * `CONF_FU`       core file path, parent directory is assumed as config location
 * `CONF_FU_FIXUP` fixup file path
 * `INSTANCE` or `CONF_FU_INSTANCE` instance name

optional:

 * `CONF_FU_PROJECT` (relative to project root, dir name to search for `project.json` file)

#### Integration to the existing project

You have two options to integrate conf-fu to existing projects:

1. Use as configuration management script

   For example, one part of your project written on `php` and you want to add `conf-fu`.
You'll need to install `conf-fu` from npm, then just use it from command line to edit configuration,
validate it, fullfill variables and placeholders. Then, just ask `conf-fu` to store
configuration artifact in place where you can read it with `php`.


2. Use within code to get a configuration.

TODO


Links
---------------

 * http://thejeffchao.com/blog/2013/09/26/an-alternative-node-dot-js-configuration-management-pattern/
 * http://metaduck.com/03-konphyg.html
 * https://github.com/mozilla/node-convict
 * https://github.com/scottmotte/dotenv
