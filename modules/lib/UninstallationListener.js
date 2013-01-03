/*
 Uninstallation Listener Library

 Usage:
   new window['piro.sakura.ne.jp'].UninstallationListener({
     id : 'test@exmaple.com',
     onuninstalled : function() { ... },
     ondisabled : function() { ... }
   });

 license: The MIT License, Copyright (c) 2009-2011 YUKI "Piro" Hiroshi
   http://github.com/piroor/fxaddonlibs/blob/master/license.txt
 original:
   http://github.com/piroor/fxaddonlibs/blob/master/UninstallationListener.js
*/

/* To work as a JS Code Module  */
if (typeof window == 'undefined' ||
	(window && typeof window.constructor == 'function')) {
	this.EXPORTED_SYMBOLS = ['UninstallationListener'];

	// If namespace.jsm is available, export symbols to the shared namespace.
	// See: http://github.com/piroor/fxaddonlibs/blob/master/namespace.jsm
	try {
		let ns = {};
		Components.utils.import('resource://my-modules/namespace.jsm', ns);
		/* var */ window = ns.getNamespaceFor('piro.sakura.ne.jp');
	}
	catch(e) {
		window = {};
	}
}

(function() {
	const currentRevision = 2;

	if (!('piro.sakura.ne.jp' in window)) window['piro.sakura.ne.jp'] = {};

	var loadedRevision = 'UninstallationListener' in window['piro.sakura.ne.jp'] ?
			window['piro.sakura.ne.jp'].UninstallationListener.prototype.revision :
			0 ;
	if (loadedRevision && loadedRevision > currentRevision) {
		return;
	}

	const Cc = Components.classes;
	const Ci = Components.interfaces;

	const ObserverService = Cc['@mozilla.org/observer-service;1']
							.getService(Ci.nsIObserverService);

	var AddonManager;
	try {
		let ns = {};
		Components.utils.import('resource://gre/modules/AddonManager.jsm', ns);
		AddonManager = ns.AddonManager;
	}
	catch(e) {
	}

	window['piro.sakura.ne.jp'].UninstallationListener = function(aArguments) {
		this.init(aArguments);
	};
	window['piro.sakura.ne.jp'].UninstallationListener.prototype = {
		revision : currentRevision,

		// for Firefox 3.6 or older
		observe : function(aSubject, aTopic, aData)
		{
			switch (aTopic)
			{
				case 'em-action-requested':
					switch (aData)
					{
						case 'item-uninstalled':
							if (this.isTargetExtension(aSubject))
								this.toBeUninstalled = true;
							break;
						case 'item-cancel-action':
							if (this.isTargetExtension(aSubject)) {
								this.toBeUninstalled = false;
								this.toBeDisabled = false;
							}
							break;
						case 'item-disabled':
							if (this.isTargetExtension(aSubject))
								this.toBeDisabled = true;
							break;
						case 'item-enabled':
							if (this.isTargetExtension(aSubject))
								this.toBeDisabled = false;
							break;
					}
					return;

				case 'quit-application-granted':
					this.destroy();
					return;
			}
		},
		isTargetExtension : function(aSubject)
		{
			return (aSubject instanceof Ci.nsIUpdateItem) && (aSubject.id == this.id);
		},

		// for Firefox 4 or later
		onEnabling : function(aAddon, aRestartRequired) {},
		onEnabled : function(aAddon) {},
		onDisabling : function(aAddon, aRestartRequired) {
			if (aAddon.id == this.id) {
				this.toBeDisabled = true;
			}
		},
		onDisabled : function(aAddon)
		{
			if (aAddon.id == this.id) {
				if (this.ondisabled) this.ondisabled();
				delete this.ondisabled;
			}
		},
		onInstalling : function(aAddon, aRestartRequired) {},
		onInstalled : function(aAddon) {},
		onUninstalling : function(aAddon, aRestartRequired) {
			if (aAddon.id == this.id) {
				this.toBeUninstalled = true;
			}
		},
		onUninstalled : function(aAddon)
		{
			if (aAddon.id == this.id) {
				if (this.onuninstalled) this.onuninstalled();
				delete this.onuninstalled;
			}
		},
		onOperationCancelled : function(aAddon)
		{
			if (aAddon.id == this.id) {
				this.toBeDisabled = false;
				this.toBeUninstalled = false;
			}
		},
		onPropertyChanged : function(aAddon, aProperties) {},

		init : function(aArguments)
		{
			if (!aArguments) return;

			this.id = (typeof aArguments == 'string') ? aArguments : aArguments.id ;

			this.toBeUninstalled = false;
			this.toBeDisabled = false;
			if (typeof aArguments == 'object') {
				this.onuninstalled = aArguments.onuninstalled;
				this.ondisabled = aArguments.ondisabled;
			}

			if (AddonManager) { // Firefox 4 or later
				AddonManager.addAddonListener(this);
			}
			else {
				ObserverService.addObserver(this, 'em-action-requested', false);
			}
			ObserverService.addObserver(this, 'quit-application-granted', false);
		},

		destroy : function()
		{
			if (this.toBeUninstalled && this.onuninstalled)
				this.onuninstalled();
			delete this.onuninstalled;

			if (this.toBeDisabled && this.ondisabled)
				this.ondisabled();
			delete this.ondisabled;

			if (AddonManager) { // Firefox 4 or later
				AddonManager.removeAddonListener(this);
			}
			else {
				ObserverService.removeObserver(this, 'em-action-requested');
			}
			ObserverService.removeObserver(this, 'quit-application-granted');
		}
	};
})();

if (window != this) { // work as a JS Code Module
	this.UninstallationListener = window['piro.sakura.ne.jp'].UninstallationListener;
}
