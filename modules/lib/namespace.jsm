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

 license: The MIT License, Copyright (c) 2010 SHIMODA "Piro" Hiroshi
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/license.txt
 original:
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/namespace.js
*/

var EXPORTED_SYMBOLS = ['getNamespaceFor'];

const Cc = Components.classes;
const Ci = Components.interfaces;

const currentRevision = 2;

const QUERY = 'namespace.jsm[piro.sakura.ne.jp]:GetExistingNamespace';
const STORAGE_PROP = 'namespaces-storage';

const ObserverService = Cc['@mozilla.org/observer-service;1']
						.getService(Ci.nsIObserverService);

var bag = Cc['@mozilla.org/hash-property-bag;1']
			.createInstance(Ci.nsIPropertyBag);
ObserverService.notifyObservers(bag, QUERY, null);

var storage;
try {
	storage = bag.getProperty(STORAGE_PROP);
}
catch(e) {
	// This is the first provider of namespaces, so I create a new storage.
	storage = {};
}

// Export the storage to other instances when they are loaded.
ObserverService.addObserver(
	{
		observe : function(aSubject, aTopic, aData)
		{
			if (aTopic != QUERY) return;
			aSubject.QueryInterface(Ci.nsIWritablePropertyBag)
				.setProperty(STORAGE_PROP, storage);
		}
	},
	QUERY,
	false
);

function getNamespaceFor(aName)
{
	if (!aName)
		throw new Error('you must specify the name of the namespace!');

	if (!(aName in storage))
		storage[aName] = {};

	return storage[aName];
}
