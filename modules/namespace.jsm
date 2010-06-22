/*
 Shared Namespace Library for JavaScript Code Modules

 Usage:
   Components.utils.import('resource://my-modules/namespace.jsm');
   var namespace = getNamespaceFor('mylibrary');
   if (!namespace.func1) {
     namespace.func1 = function() { ... };
     namespace.func2 = function() { ... };
   }
   var EXPORTED_SYMBOLS = ['func1', 'func2'];
   var func1 = namespace.func1;
   var func2 = namespace.func2;

 lisence: The MIT License, Copyright (c) 2010 SHIMODA "Piro" Hiroshi
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/license.txt
 original:
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/namespace.js
*/

var EXPORTED_SYMBOLS = ['getNamespaceFor'];

const Cc = Components.classes;
const Ci = Components.interfaces;

const currentRevision = 1;

const Application = '@mozilla.org/fuel/application;1' in Cc ?
						Cc['@mozilla.org/fuel/application;1'].getService(Ci.fuelIApplication) :
					'@mozilla.org/steel/application;1' in Cc ?
						Cc['@mozilla.org/steel/application;1'].getService(Ci.steelIApplication) :
						null ;
if (!Application)
	throw new Error('there is no backend for shared namespaces!');

const storage = Application.storage;

if (!storage.has('sharednamespaces@piro.sakura.ne.jp'))
	storage.set('sharednamespaces@piro.sakura.ne.jp', {});

var namespaces = storage.get('sharednamespaces@piro.sakura.ne.jp', null);

function getNamespaceFor(aName)
{
	if (!aName)
		throw new Error('you must specify the name of the namespace!');

	if (!(aName in namespaces))
		namespaces[aName] = {};

	return namespaces[aName];
}
