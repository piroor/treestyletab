/*
 Extensions Compatibility Library

 Usage:
     var extensions = window['piro.sakura.ne.jp'].extensions;
     extensions.isAvailable('my.extension.id@example.com', {
       ok : function() { extensions.goToOptions('my.extension.id@example.com'); },
       ng : function() { alert('NOT INSTALLED'); }
     });
     extensions.isInstalled('my.extension.id@example.com', {
       ok : function(aDir) {
         var dir = aDir; // nsILocalFile
       }
     });

 license: The MIT License, Copyright (c) 2009-2016 YUKI "Piro" Hiroshi
 original:
   http://github.com/piroor/fxaddonlib-extensions
*/

/* To work as a JS Code Module */
if (typeof window == 'undefined' ||
	(window && typeof window.constructor == 'function')) {
	this.EXPORTED_SYMBOLS = ['extensions'];

	// If namespace.jsm is available, export symbols to the shared namespace.
	// See: http://github.com/piroor/fxaddonlibs/blob/master/namespace.jsm
	try {
		let ns = {};
		Components.utils.import('resource://treestyletab-modules/lib/namespace.jsm', ns);
		/* var */ window = ns.getNamespaceFor('piro.sakura.ne.jp');
	}
	catch(e) {
		window = {};
	}
}

(function() {
	const currentRevision = 13;

	if (!('piro.sakura.ne.jp' in window)) window['piro.sakura.ne.jp'] = {};

	var loadedRevision = 'extensions' in window['piro.sakura.ne.jp'] ?
			window['piro.sakura.ne.jp'].extensions.revision :
			0 ;
	if (loadedRevision && loadedRevision > currentRevision) {
		return;
	}

	const Cc = Components.classes;
	const Ci = Components.interfaces;

	var { AddonManager } = Components.utils.import('resource://gre/modules/AddonManager.jsm', {});

	window['piro.sakura.ne.jp'].extensions = {
		revision : currentRevision,

		_formatCallbacks : function(aOKCallback, aNGCallback)
		{
			var callbacks = {
					ok : aOKCallback,
					ng : aNGCallback
				};
			if (typeof aOKCallback != 'function')
				callbacks = aOKCallback;

			if (!('ok' in callbacks) || typeof callbacks.ok != 'function')
				callbacks.ok = function() {};
			if (!('ng' in callbacks) || typeof callbacks.ng != 'function')
				callbacks.ng = function() {};

			return callbacks;
		},


		isAvailable : function(aId, aOKCallback, aNGCallback)
		{
			return this.isEnabled(aId, aOKCallback, aNGCallback);
		},


		isInstalled : function(aId, aOKCallback, aNGCallback)
		{
			var callbacks = this._formatCallbacks(aOKCallback, aNGCallback);
			AddonManager.getAddonByID(aId, function(aAddon) {
				callbacks[aAddon ? 'ok' : 'ng']();
			});
		},


		isEnabled : function(aId, aOKCallback, aNGCallback)
		{
			var callbacks = this._formatCallbacks(aOKCallback, aNGCallback);
			AddonManager.getAddonByID(aId, function(aAddon) {
				callbacks[aAddon && aAddon.isActive ? 'ok' : 'ng']();
			});
		},


		getInstalledLocation : function(aId, aCallback)
		{
			AddonManager.getAddonByID(aId, function(aAddon) {
				var location = null;
				if (aAddon)
					location = aAddon.getResourceURI('/').QueryInterface(Ci.nsIFileURL).file.clone();
				aCallback(location);
			});
		},

		getVersion : function(aId, aCallback)
		{
			AddonManager.getAddonByID(aId, function(aAddon) {
				aCallback(aAddon ? aAddon.version : null );
			});
		},


		goToOptions : function(aId, aOwnerWindow)
		{
			var self = this;
			var callback = function(aURI) {
					self.goToOptionsInternal(aURI, aOwnerWindow);
				};
			AddonManager.getAddonByID(aId, function(aAddon) {
				callback(aAddon && aAddon.isActive ? aAddon.optionsURL : null );
			});
		},
		goToOptionsInternal : function(aURI, aOwnerWindow)
		{
			if (!aURI) return;

			var windows = this._WindowMediator.getEnumerator(null);
			while (windows.hasMoreElements())
			{
				let win = windows.getNext();
				if (win.location.href == aURI) {
					win.focus();
					return;
				}
			}
			var instantApply = false;
			try {
				instantApply = this._Prefs.getBoolPref('browser.preferences.instantApply');
			}
			catch(e) {
			}
			(aOwnerWindow || window).openDialog(
				aURI,
				'',
				'chrome,titlebar,toolbar,centerscreen,' + (instantApply ? 'dialog=no' : 'modal' )
			);
		}
	};
})();

if (window != this) { // work as a JS Code Module
	this.extensions = window['piro.sakura.ne.jp'].extensions;
}

