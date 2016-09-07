/**
 * @fileOverview Uninstallation Listener Library
 * @author       YUKI "Piro" Hiroshi
 * @version      3
 *
 * @license
 *   The MIT License, Copyright (c) 2009-2016 YUKI "Piro" Hiroshi.
 *   https://github.com/piroor/fxaddonlib-uninstallation-listener/blob/master/license.txt
 * @url https://github.com/piroor/fxaddonlib-uninstallation-listener
 *
 * Usage:
 *   new UninstallationListener({
 *     id : 'test@exmaple.com',
 *    onuninstalled : function() { ... },
 *     ondisabled : function() { ... }
 *   });
 */

var EXPORTED_SYMBOLS = ['UninstallationListener'];


const Cc = Components.classes;
const Ci = Components.interfaces;

const ObserverService = Cc['@mozilla.org/observer-service;1']
						.getService(Ci.nsIObserverService);

var { AddonManager } = Components.utils.import('resource://gre/modules/AddonManager.jsm', {});

var UninstallationListener = function(aArguments) {
	this.init(aArguments);
};
UninstallationListener.prototype = {
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

		AddonManager.addAddonListener(this);
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

		AddonManager.removeAddonListener(this);
		ObserverService.removeObserver(this, 'quit-application-granted');
	},

	observe : function(aSubject, aTopic, aData)
	{
		switch (aTopic)
		{
			case 'quit-application-granted':
				this.destroy();
				return;
		}
	}
};

