/*
 Shared Namespace Library for JavaScript Code Modules

 Usage:
   Components.utils.import('resource://my-modules/namespace.jsm');
   var namespace = getNamespaceFor('mylibrary');
   namespace.func1 = function() { ... };
   namespace.func2 = function() { ... };
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

var hiddenWindow = Cc['@mozilla.org/appshell/appShellService;1']
					.getService(Ci.nsIAppShellService)
					.hiddenDOMWindow;

if (!('piro.sakura.ne.jp' in hiddenWindow))
	hiddenWindow['piro.sakura.ne.jp'] = {};

var namespaces = hiddenWindow['piro.sakura.ne.jp'].sharedNameSpaces || {};
if (!('sharedNameSpaces' in hiddenWindow['piro.sakura.ne.jp']))
	hiddenWindow['piro.sakura.ne.jp'].sharedNameSpaces = namespaces;

function getNamespaceFor(aName)
{
	if (!aName)
		throw new Error('you must specify the name of the namespace!');

	if (!(aName in namespaces))
		namespaces[aName] = {};

	return namespaces[aName];
}
