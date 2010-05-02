/*
 Extensions Compatibility Library

 Usage:
   if (window['piro.sakura.ne.jp'].extensions.isAvailable('my.extension.id@example.com'))
       window['piro.sakura.ne.jp'].extensions.goToOptions('my.extension.id@example.com');
   // just same to:
   // if (window['piro.sakura.ne.jp'].extensions.isInstalled('my.extension.id@example.com') &&
   //     window['piro.sakura.ne.jp'].extensions.isEnabled('my.extension.id@example.com'))
   //     window['piro.sakura.ne.jp'].extensions.goToOptions('my.extension.id@example.com');

 lisence: The MIT License, Copyright (c) 2009-2010 SHIMODA "Piro" Hiroshi
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/license.txt
 original:
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/extensions.js
*/
(function() {
	const currentRevision = 3;

	if (!('piro.sakura.ne.jp' in window)) window['piro.sakura.ne.jp'] = {};

	var loadedRevision = 'extensions' in window['piro.sakura.ne.jp'] ?
			window['piro.sakura.ne.jp'].extensions.revision :
			0 ;
	if (loadedRevision && loadedRevision > currentRevision) {
		return;
	}

	// Firefox 3.7 or later
	var AM = {};
	if ('@mozilla.org/addons/integration;1' in Components.classes)
		Components.utils.import('resource://gre/modules/AddonManager.jsm', AM);

	window['piro.sakura.ne.jp'].extensions = {
		revision : currentRevision,

		// Firefox 3.7 or later
		getInstalledAddon : function(aId)
		{
			var addon;
			AM.AddonManager.getAddonByID(aId, function(aAddon) {
				addon = aAddon;
			});
			var thread = Components.classes['@mozilla.org/thread-manager;1']
							.getService()
							.mainThread;
			while (addon === void(0)) {
				thread.processNextEvent(true);
			}
			return addon;
		},

		// Firefox 3.6 or older
		ExtensionManager : ('@mozilla.org/extensions/manager;1' in Components.classes) ?
			Components.classes['@mozilla.org/extensions/manager;1']
				.getService(Components.interfaces.nsIExtensionManager) :
			null,
		RDF : Components.classes['@mozilla.org/rdf/rdf-service;1']
			.getService(Components.interfaces.nsIRDFService),
		WindowMediator : Components.classes['@mozilla.org/appshell/window-mediator;1']
			.getService(Components.interfaces.nsIWindowMediator),
		Prefs : Components.classes['@mozilla.org/preferences;1']
			.getService(Components.interfaces.nsIPrefBranch),

		isAvailable : function(aId)
		{
			return this.ExtensionManager ? this.isAvailable_EM(aId) : this.isAvailable_AM(aId) ;
		},
		isAvailable_EM : function(aId)
		{
			return this.isInstalled(aId) && this.isEnabled(aId);
		},
		isAvailable_AM : function(aId)
		{
			var addon = this.getInstalledAddon(aId);
			if (!addon) return false;
			return addon.isActive;
		},

		isInstalled : function(aId)
		{
			return this.ExtensionManager ? this.isInstalled_EM(aId) : this.isInstalled_AM(aId) ;
		},
		isInstalled_EM : function(aId)
		{
			return this.ExtensionManager.getInstallLocation(aId);
		},
		isInstalled_AM : function(aId)
		{
			return this.getInstalledAddon(aId);
		},

		isEnabled : function(aId)
		{
			return this.ExtensionManager ? this.isEnabled_EM(aId) : this.isEnabled_AM(aId) ;
		},
		isEnabled_EM : function(aId)
		{
			var res  = this.RDF.GetResource('urn:mozilla:item:'+aId);
			var appDisabled = false;
			try {
				appDisabled = this.ExtensionManager.datasource.GetTarget(
						res,
						this.RDF.GetResource('http://www.mozilla.org/2004/em-rdf#appDisabled'),
						true
					).QueryInterface(Components.interfaces.nsIRDFLiteral)
					.Value == 'true';
			}
			catch(e) {
			}
			var userDisabled = false;
			try {
				userDisabled = this.ExtensionManager.datasource.GetTarget(
						res,
						this.RDF.GetResource('http://www.mozilla.org/2004/em-rdf#userDisabled'),
						true
					).QueryInterface(Components.interfaces.nsIRDFLiteral)
					.Value == 'true';
			}
			catch(e) {
			}

			return !appDisabled && !userDisabled;
		},
		isEnabled_AM : function(aId)
		{
			return false;
		},

		goToOptions : function(aId)
		{
			var uri = this.ExtensionManager ? this.getOptionsURI_EM(aId) : this.getOptionsURI_AM(aId) ;
			if (!uri) return;

			var windows = this.WindowMediator.getEnumerator(null);
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
				instantApply = this.Prefs.getBoolPref('browser.preferences.instantApply');
			}
			catch(e) {
			}
			window.openDialog(
				uri,
				'',
				'chrome,titlebar,toolbar,centerscreen,' + (instantApply ? 'dialog=no' : 'modal' )
			);
		},
		getOptionsURI_EM : function(aId)
		{
			var res  = this.RDF.GetResource('urn:mozilla:item:'+aId);
			var uri;
			try {
				uri = this.ExtensionManager.datasource.GetTarget(
						res,
						this.RDF.GetResource('http://www.mozilla.org/2004/em-rdf#optionsURL'),
						true
					).QueryInterface(Components.interfaces.nsIRDFLiteral)
					.Value;
			}
			catch(e) {
			}
			return uri;
		},
		getOptionsURI_AM : function(aId)
		{
			var addon = this.getInstalledAddon(aId);
			if (!addon || !addon.isActive) return null;
			return addon.optionsURL;
		}
	};
})();
