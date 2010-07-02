/*
 Extensions Compatibility Library

 Usage:
   Asynchronus:
     var extensions = window['piro.sakura.ne.jp'].extensions;
     extensions.isAvailable('my.extension.id@example.com', {
       ok : function() { extensions.goToOptions('my.extension.id@example.com'); },
       ng : function() { alert('NOT INSTALLED'); }
     });
     // just same to:
     // extensions.isInstalled('my.extension.id@example.com', {
     //   ok : function() {
     //     extensions.isEnabled('my.extension.id@example.com', {
     //       ok : function() { extensions.goToOptions('my.extension.id@example.com'); }
     //     });
     //   }
     // });
     extensions.isInstalled('my.extension.id@example.com', {
       ok : function(aDir) {
         var dir = aDir; // nsILocalFile
       }
     });

   Synchronus: (DEPRECATED)
     if (extensions.isAvailable('my.extension.id@example.com'))
         extensions.goToOptions('my.extension.id@example.com');
     // just same to:
     // if (extensions.isInstalled('my.extension.id@example.com') &&
     //     extensions.isEnabled('my.extension.id@example.com'))
     //     extensions.goToOptions('my.extension.id@example.com');
     var dir = extensions.getInstalledLocation('my.extension.id@example.com'); // nsILocalFile

 lisence: The MIT License, Copyright (c) 2009-2010 SHIMODA "Piro" Hiroshi
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/license.txt
 original:
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/extensions.js
*/

/* To work as a JS Code Module */
if (typeof window == 'undefined') {
	this.EXPORTED_SYMBOLS = ['extensions'];

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
	const currentRevision = 7;

	if (!('piro.sakura.ne.jp' in window)) window['piro.sakura.ne.jp'] = {};

	var loadedRevision = 'extensions' in window['piro.sakura.ne.jp'] ?
			window['piro.sakura.ne.jp'].extensions.revision :
			0 ;
	if (loadedRevision && loadedRevision > currentRevision) {
		return;
	}

	const Cc = Components.classes;
	const Ci = Components.interfaces;

	// Firefox 3.7 or later
	var AM = {};
	if ('@mozilla.org/addons/integration;1' in Cc)
		Components.utils.import('resource://gre/modules/AddonManager.jsm', AM);

	window['piro.sakura.ne.jp'].extensions = {
		revision : currentRevision,

		// Firefox 3.7 or later
		_getInstalledAddon : function(aId)
		{
			var addon;
			AM.AddonManager.getAddonByID(aId, function(aAddon) {
				addon = aAddon;
			});
			var thread = Cc['@mozilla.org/thread-manager;1']
							.getService()
							.mainThread;
			while (addon === void(0)) {
				thread.processNextEvent(true);
			}
			return addon;
		},

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

		// Firefox 3.6 or older
		_ExtensionManager : ('@mozilla.org/extensions/manager;1' in Cc) ?
			Cc['@mozilla.org/extensions/manager;1']
				.getService(Ci.nsIExtensionManager) :
			null,
		_RDF : Cc['@mozilla.org/rdf/rdf-service;1']
			.getService(Ci.nsIRDFService),
		_WindowMediator : Cc['@mozilla.org/appshell/window-mediator;1']
			.getService(Ci.nsIWindowMediator),
		_Prefs : Cc['@mozilla.org/preferences;1']
			.getService(Ci.nsIPrefBranch),


		isAvailable : function(aId, aOKCallback, aNGCallback)
		{
			if (!aOKCallback)
				return this._ExtensionManager ? this._isAvailable_EM(aId) : this._isAvailable_AM(aId) ;

			var callbacks = this._formatCallbacks(aOKCallback, aNGCallback);
			if (this._ExtensionManager) {
				if (this._isAvailable_EM(aId))
					callbacks.ok();
				else
					callbacks.ng();
			}
			else {
				AM.AddonManager.getAddonByID(aId, function(aAddon) {
					if (aAddon && aAddon.isActive)
						callbacks.ok();
					else
						callbacks.ng();
				});
			}
		},
		_isAvailable_EM : function(aId)
		{
			return (this._isInstalled_EM(aId) && this._isEnabled_EM(aId)) ? true : false ;
		},
		_isAvailable_AM : function(aId)
		{
			var addon = this._getInstalledAddon(aId);
			if (!addon) return false;
			return addon.isActive;
		},


		isInstalled : function(aId, aOKCallback, aNGCallback)
		{
			if (!aOKCallback)
				return this._ExtensionManager ? this._isInstalled_EM(aId) : this._isInstalled_AM(aId) ;

			var callbacks = this._formatCallbacks(aOKCallback, aNGCallback);
			if (this._ExtensionManager) {
				if (this._isInstalled_EM(aId))
					callbacks.ok(this._getInstalledLocation_EM(aId));
				else
					callbacks.ng(null);
			}
			else {
				AM.AddonManager.getAddonByID(aId, function(aAddon) {
					if (aAddon)
						callbacks.ok(null);
					else
						callbacks.ng(null);
				});
			}
		},
		_isInstalled_EM : function(aId)
		{
			return this._ExtensionManager.getInstallLocation(aId) ? true : false ;
		},
		_isInstalled_AM : function(aId)
		{
			return this._getInstalledAddon(aId) ? true : false ;
		},


		isEnabled : function(aId, aOKCallback, aNGCallback)
		{
			if (!aOKCallback)
				return this._ExtensionManager ? this._isEnabled_EM(aId) : this._isEnabled_AM(aId) ;

			var callbacks = this._formatCallbacks(aOKCallback, aNGCallback);
			if (this._ExtensionManager) {
				if (this._isInstalled_EM(aId))
					callbacks.ok();
				else
					callbacks.ng();
			}
			else {
				this.isAvailable(aId, callbacks);
			}
		},
		_isEnabled_EM : function(aId)
		{
			var res  = this._RDF.GetResource('urn:mozilla:item:'+aId);
			var appDisabled = false;
			try {
				appDisabled = this._ExtensionManager.datasource.GetTarget(
						res,
						this._RDF.GetResource('http://www.mozilla.org/2004/em-rdf#appDisabled'),
						true
					).QueryInterface(Ci.nsIRDFLiteral)
					.Value == 'true';
			}
			catch(e) {
			}
			var userDisabled = false;
			try {
				userDisabled = this._ExtensionManager.datasource.GetTarget(
						res,
						this._RDF.GetResource('http://www.mozilla.org/2004/em-rdf#userDisabled'),
						true
					).QueryInterface(Ci.nsIRDFLiteral)
					.Value == 'true';
			}
			catch(e) {
			}

			return !appDisabled && !userDisabled;
		},
		_isEnabled_AM : function(aId)
		{
			return false;
		},


		getInstalledLocation : function(aId, aCallback)
		{
			if (!aCallback)
				return this._ExtensionManager ? this._getInstalledLocation_EM(aId) : this._getInstalledLocation_AM(aId) ;

			if (this._ExtensionManager) {
				aCallback(this._getInstalledLocation_EM(aId));
			}
			else {
				AM.AddonManager.getAddonByID(aId, function(aAddon) {
					var location = null;
					if (aAddon && aAddon.isActive) {
						location = aAddon.getResourceURI('/').QueryInterface(Ci.nsIFileURL).file.clone();
					}
					aCallback(location);
				});
			}
		},
		_getInstalledLocation_EM : function(aId)
		{
			var addon = this._ExtensionManager.getInstallLocation(aId);
			if (!addon) return;
			var dir = addon.location.clone();
			dir.append(aId);
			return dir;
		},
		_getInstalledLocation_AM : function(aId)
		{
			var addon = this._getInstalledAddon(aId);
			if (!addon || !addon.isActive) return null;
			return aAddon.getResourceURI('/').QueryInterface(Ci.nsIFileURL).file.clone();
		},


		goToOptions : function(aId, aOwnerWindow)
		{
			var self = this;
			var callback = function(aURI) {
					self.goToOptionsInternal(aURI, aOwnerWindow);
				};

			if (this._ExtensionManager)
				this._getOptionsURI_EM(aId, callback);
			else
				this._getOptionsURI_AM(aId, callback);
		},
		_getOptionsURI_EM : function(aId, aCallback)
		{
			var res  = this._RDF.GetResource('urn:mozilla:item:'+aId);
			var uri = null;
			try {
				uri = this._ExtensionManager.datasource.GetTarget(
						res,
						this._RDF.GetResource('http://www.mozilla.org/2004/em-rdf#optionsURL'),
						true
					).QueryInterface(Ci.nsIRDFLiteral)
					.Value;
			}
			catch(e) {
			}
			return aCallback ? aCallback(uri) : uri ;
		},
		_getOptionsURI_AM : function(aId, aCallback)
		{
			if (aCallback) {
				AM.AddonManager.getAddonByID(aId, function(aAddon) {
					aCallback(aAddon && aAddon.isActive ? aAddon.optionsURL : null );
				});
				return null;
			}
			else {
				var addon = this._getInstalledAddon(aId);
				return (addon && addon.isActive) ? addon.optionsURL : null ;
			}
		},

		goToOptionsNow : function(aId, aOwnerWindow)
		{
			this.goToOptionsInternal(
				(this._ExtensionManager ? this._getOptionsURI_EM(aId) : this._getOptionsURI_AM(aId) ),
				aOwnerWindow
			);
		},

		goToOptionsInternal : function(aURI, aOwnerWindow)
		{
			if (!aURI) return;

			var windows = this._WindowMediator.getEnumerator(null);
			while (windows.hasMoreElements())
			{
				let win = windows.getNext();
				if (win.location.href == uri) {
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
				uri,
				'',
				'chrome,titlebar,toolbar,centerscreen,' + (instantApply ? 'dialog=no' : 'modal' )
			);
		}
	};
})();

if (window != this) { // work as a JS Code Module
	this.extensions = window['piro.sakura.ne.jp'].extensions;
}
