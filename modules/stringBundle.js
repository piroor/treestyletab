/*
 string bundle utility

 Usage:
   var bundle = window['piro.sakura.ne.jp']
                         .stringBundle
                         .get('chrome://example/locale/example.properties');
   bundle.getString('key1');
   bundle.getFormattedString('key2', [val1, val2]);

 lisence: The MIT License, Copyright (c) 2009 SHIMODA "Piro" Hiroshi
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/license.txt
 original:
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/stringBundle.js
*/

/* To work as a JS Code Module (*require namespace.jsm)
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/namespace.jsm */
if (typeof window == 'undefined') {
	this.EXPORTED_SYMBOLS = ['stringBundle'];

	// If namespace.jsm is available, export symbols to the shared namespace.
	// See: http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/namespace.jsm
	try {
		let ns = {};
		Components.utils.import('resource://treestyletab-modules/namespace.jsm', ns);
		/* var */ window = ns.getNamespaceFor('piro.sakura.ne.jp');
	}
	catch(e) {
		window = {};
	}
}

(function() {
	const currentRevision = 1;

	if (!('piro.sakura.ne.jp' in window)) window['piro.sakura.ne.jp'] = {};

	var loadedRevision = 'stringBundle' in window['piro.sakura.ne.jp'] ?
			window['piro.sakura.ne.jp'].stringBundle.revision :
			0 ;
	if (loadedRevision && loadedRevision > currentRevision) {
		return;
	}

	var Cc = Components.classes;
	var Ci = Components.interfaces;

	window['piro.sakura.ne.jp'].stringBundle = {
		revision : currentRevision,

		get : function(aURI)
		{
			if (!(aURI in this._cache)) {
				this._cache[aURI] = new StringBundle(aURI);
			}
			return this._cache[aURI];
		},
		_cache : {}
	};

	const Service = Cc['@mozilla.org/intl/stringbundle;1']
						.getService(Ci.nsIStringBundleService);

	function StringBundle(aURI) 
	{
		this._bundle = Service.createBundle(aURI);
	}
	StringBundle.prototype = {
		getString : function(aKey) {
			try {
				return this._bundle.GetStringFromName(aKey);
			}
			catch(e) {
			}
			return '';
		},
		getFormattedString : function(aKey, aArray) {
			try {
				return this._bundle.formatStringFromName(aKey, aArray, aArray.length);
			}
			catch(e) {
			}
			return '';
		},
		get strings() {
			return this._bundle.getSimpleEnumeration();
		}
	};
})();

if (window != this) { // work as a JS Code Module
	this.stringBundle = window['piro.sakura.ne.jp'].stringBundle;
}
