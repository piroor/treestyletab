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

 lisence: The MIT License, Copyright (c) 2009 SHIMODA "Piro" Hiroshi
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/license.txt
 original:
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/prefs.js
*/
(function() {
	const currentRevision = 2;

	if (!('piro.sakura.ne.jp' in window)) window['piro.sakura.ne.jp'] = {};

	var loadedRevision = 'prefs' in window['piro.sakura.ne.jp'] ?
			window['piro.sakura.ne.jp'].prefs.revision :
			0 ;
	if (loadedRevision && loadedRevision > currentRevision) {
		return;
	}

	window['piro.sakura.ne.jp'].prefs = {
		revision : currentRevision,

		get Prefs() 
		{
			if (!this._Prefs) {
				this._Prefs = Components.classes['@mozilla.org/preferences;1'].getService(Components.interfaces.nsIPrefBranch);
			}
			return this._Prefs;
		},
		_Prefs : null,

		get DefaultPrefs() 
		{
			if (!this._DefaultPrefs) {
				this._DefaultPrefs = Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefService).getDefaultBranch(null);
			}
			return this._DefaultPrefs;
		},
		_DefaultPrefs : null,
	 
		getPref : function(aPrefstring, aBranch) 
		{
			if (!aBranch) aBranch = this.Prefs;
			try {
				switch (aBranch.getPrefType(aPrefstring))
				{
					case this.Prefs.PREF_STRING:
						return decodeURIComponent(escape(aBranch.getCharPref(aPrefstring)));
						break;
					case this.Prefs.PREF_INT:
						return aBranch.getIntPref(aPrefstring);
						break;
					default:
						return aBranch.getBoolPref(aPrefstring);
						break;
				}
			}
			catch(e) {
			}

			return null;
		},

		getDefaultPref : function(aPrefstring)
		{
			return this.getPref(aPrefstring, this.DefaultPrefs);
		},
	 
		setPref : function(aPrefstring, aNewValue, aBranch) 
		{
			if (!aBranch) aBranch = this.Prefs;

			var type;
			try {
				type = typeof aNewValue;
			}
			catch(e) {
				type = null;
			}

			switch (type)
			{
				case 'string':
					aBranch.setCharPref(aPrefstring, unescape(encodeURIComponent(aNewValue)));
					break;
				case 'number':
					aBranch.setIntPref(aPrefstring, parseInt(aNewValue));
					break;
				default:
					aBranch.setBoolPref(aPrefstring, aNewValue);
					break;
			}
			return true;
		},

		setDefaultPref : function(aPrefstring)
		{
			return this.setPref(aPrefstring, aNewValue, this.DefaultPrefs);
		},
	 
		clearPref : function(aPrefstring) 
		{
			try {
				this.Prefs.clearUserPref(aPrefstring);
			}
			catch(e) {
			}

			return;
		},
	 
		addPrefListener : function(aObserver) 
		{
			var domains = ('domains' in aObserver) ? aObserver.domains : [aObserver.domain] ;
			try {
				var pbi = this.Prefs.QueryInterface(Components.interfaces.nsIPrefBranchInternal);
				for (var i = 0; i < domains.length; i++)
					pbi.addObserver(domains[i], aObserver, false);
			}
			catch(e) {
			}
		},
	 
		removePrefListener : function(aObserver) 
		{
			var domains = ('domains' in aObserver) ? aObserver.domains : [aObserver.domain] ;
			try {
				var pbi = this.Prefs.QueryInterface(Components.interfaces.nsIPrefBranchInternal);
				for (var i = 0; i < domains.length; i++)
					pbi.removeObserver(domains[i], aObserver, false);
			}
			catch(e) {
			}
		}
	};
})();
