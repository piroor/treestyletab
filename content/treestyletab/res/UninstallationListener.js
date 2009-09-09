/*
 Uninstallation Listener Library

 Usage:
   new window['piro.sakura.ne.jp'].UninstallationListener({
     id : 'test@exmaple.com',
     onuninstalled : function() { ... },
     ondisabled : function() { ... }
   });

 lisence: The MIT License, Copyright (c) 2009 SHIMODA "Piro" Hiroshi
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/license.txt
 original:
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/UninstallationListener.js
*/
(function() {
	const currentRevision = 1;

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

	window['piro.sakura.ne.jp'].UninstallationListener = function(aArguments) {
		this.init(aArguments);
	};
	window['piro.sakura.ne.jp'].UninstallationListener.prototype = {
		revision : currentRevision,

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

				case 'quit-application':
					this.destroy();
					return;
			}
		},
		isTargetExtension : function(aSubject)
		{
			return (aSubject instanceof Ci.nsIUpdateItem) && (aSubject.id == this.id);
		},

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

			ObserverService.addObserver(this, 'em-action-requested', false);
			ObserverService.addObserver(this, 'quit-application', false);
		},

		destroy : function()
		{
			if (this.toBeUninstalled && this.onuninstalled)
				this.onuninstalled();
			delete this.onuninstalled;

			if (this.toBeDisabled && this.ondisabled)
				this.ondisabled();
			delete this.ondisabled;

			ObserverService.removeObserver(this, 'em-action-requested');
			ObserverService.removeObserver(this, 'quit-application');
		}
	};
})();
