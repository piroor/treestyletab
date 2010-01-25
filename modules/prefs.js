var EXPORTED_SYMBOLS = ['window'];
var window = {};

/*
 Preferences Library

 Usage:
   var value = window['piro.sakura.ne.jp'].prefs.getPref('my.extension.pref');
   window['piro.sakura.ne.jp'].prefs.setPref('my.extension.pref', true);
   window['piro.sakura.ne.jp'].prefs.clearPref('my.extension.pref');
   var listener = {
         domains : [
           'browser.tabs',
           'extensions.someextension'
         ],
         observe : function(aSubject, aTopic, aData)
         {
           if (aTopic != 'nsPref:changed') return;
           var value = window['piro.sakura.ne.jp'].prefs.getPref(aData);
         }
       };
   window['piro.sakura.ne.jp'].prefs.addPrefListener(listener);
   window['piro.sakura.ne.jp'].prefs.removePrefListener(listener);

 lisence: The MIT License, Copyright (c) 2009-2010 SHIMODA "Piro" Hiroshi
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/license.txt
 original:
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/prefs.js
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/prefs.test.js
*/
(function() {
	const currentRevision = 4;

	if (!('piro.sakura.ne.jp' in window)) window['piro.sakura.ne.jp'] = {};

	var loadedRevision = 'prefs' in window['piro.sakura.ne.jp'] ?
			window['piro.sakura.ne.jp'].prefs.revision :
			0 ;
	if (loadedRevision && loadedRevision > currentRevision) {
		return;
	}

	const Cc = Components.classes;
	const Ci = Components.interfaces;

	window['piro.sakura.ne.jp'].prefs = {
		revision : currentRevision,

		Prefs : Cc['@mozilla.org/preferences;1']
					.getService(Ci.nsIPrefBranch)
					.QueryInterface(Ci.nsIPrefBranch2),

		DefaultPrefs : Cc['@mozilla.org/preferences-service;1']
					.getService(Ci.nsIPrefService)
					.getDefaultBranch(null),
	 
		getPref : function(aPrefstring, aBranch) 
		{
			if (!aBranch) aBranch = this.Prefs;
			switch (aBranch.getPrefType(aPrefstring))
			{
				case aBranch.PREF_STRING:
					return decodeURIComponent(escape(aBranch.getCharPref(aPrefstring)));

				case aBranch.PREF_INT:
					return aBranch.getIntPref(aPrefstring);

				case aBranch.PREF_BOOL:
					return aBranch.getBoolPref(aPrefstring);

				case aBranch.PREF_INVALID:
				default:
					return null;
			}
		},

		getDefaultPref : function(aPrefstring)
		{
			return this.getPref(aPrefstring, this.DefaultPrefs);
		},
	 
		setPref : function(aPrefstring, aNewValue, aBranch) 
		{
			if (!aBranch) aBranch = this.Prefs;
			switch (typeof aNewValue)
			{
				case 'string':
					return aBranch.setCharPref(aPrefstring, unescape(encodeURIComponent(aNewValue)));

				case 'number':
					return aBranch.setIntPref(aPrefstring, parseInt(aNewValue));

				default:
					return aBranch.setBoolPref(aPrefstring, aNewValue);
			}
		},

		setDefaultPref : function(aPrefstring, aNewValue)
		{
			return this.setPref(aPrefstring, aNewValue, this.DefaultPrefs);
		},
	 
		clearPref : function(aPrefstring) 
		{
			if (this.Prefs.prefHasUserValue(aPrefstring))
				this.Prefs.clearUserPref(aPrefstring);
		},
	 
		addPrefListener : function(aObserver) 
		{
			var domains = ('domains' in aObserver) ? aObserver.domains : [aObserver.domain] ;
			try {
				for each (var domain in domains)
					this.Prefs.addObserver(domain, aObserver, false);
			}
			catch(e) {
			}
		},
	 
		removePrefListener : function(aObserver) 
		{
			var domains = ('domains' in aObserver) ? aObserver.domains : [aObserver.domain] ;
			try {
				for each (var domain in domains)
					this.Prefs.removeObserver(domain, aObserver, false);
			}
			catch(e) {
			}
		}
	};
})();
