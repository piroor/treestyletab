/*
 lisence: The MIT License, Copyright (c) 2009 SHIMODA "Piro" Hiroshi
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/license.txt
 original:
   https://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/prefs.js
*/
(function() {
	const currentRevision = 1;

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
	 
		getPref : function(aPrefstring) 
		{
			try {
				switch (this.Prefs.getPrefType(aPrefstring))
				{
					case this.Prefs.PREF_STRING:
						return decodeURIComponent(escape(this.Prefs.getCharPref(aPrefstring)));
						break;
					case this.Prefs.PREF_INT:
						return this.Prefs.getIntPref(aPrefstring);
						break;
					default:
						return this.Prefs.getBoolPref(aPrefstring);
						break;
				}
			}
			catch(e) {
			}

			return null;
		},
	 
		setPref : function(aPrefstring, aNewValue) 
		{
			var pref = this.Prefs ;
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
					pref.setCharPref(aPrefstring, unescape(encodeURIComponent(aNewValue)));
					break;
				case 'number':
					pref.setIntPref(aPrefstring, parseInt(aNewValue));
					break;
				default:
					pref.setBoolPref(aPrefstring, aNewValue);
					break;
			}
			return true;
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
