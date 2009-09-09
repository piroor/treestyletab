/*
 FUEL Event Listener Library

 Usage:
   new window['piro.sakura.ne.jp'].FUELEventListener({
     extension : Application.extensions.get('test@exmaple.com'),
     onuninstalled : function() { ... },
     ondisabled : function() { ... }
   });

 lisence: The MIT License, Copyright (c) 2009 SHIMODA "Piro" Hiroshi
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/license.txt
 original:
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/FUELEventListener.js
*/
(function() {
	const currentRevision = 1;

	if (!('piro.sakura.ne.jp' in window)) window['piro.sakura.ne.jp'] = {};

	var loadedRevision = 'FUELEventListener' in window['piro.sakura.ne.jp'] ?
			window['piro.sakura.ne.jp'].FUELEventListener.prototype.revision :
			0 ;
	if (loadedRevision && loadedRevision > currentRevision) {
		return;
	}

	const Cc = Components.classes;
	const Ci = Components.interfaces;

	const ObserverService = Cc['@mozilla.org/observer-service;1']
							.getService(Ci.nsIObserverService);

	window['piro.sakura.ne.jp'].FUELEventListener = function(aArguments) {
		this.init(aArguments);
	};
	window['piro.sakura.ne.jp'].FUELEventListener.prototype = {
		revision : currentRevision,

		handleEvent : function(aEvent)
		{
			switch (aEvent.type)
			{
				case 'uninstall':
					this.toBeUninstalled = true;
					break;
				case 'cancel':
					this.toBeUninstalled = false;
					this.toBeDisabled = false;
					break;
				case 'disable':
					this.toBeDisabled = true;
					break;
				case 'enable':
					this.toBeDisabled = false;
					break;
			}
		},

		observe : function(aSubject, aTopic, aData)
		{
			switch (aTopic)
			{
				case 'quit-application':
					this.destroy();
					return;
			}
		},

		init : function(aArguments)
		{
			if (!aArguments) return;

			if ('extension' in aArguments) {
				this.extension = aArguments.extension;
				this.extension.events.addListener('uninstall', this);
				this.extension.events.addListener('cancel', this);
				this.extension.events.addListener('disable', this);
				this.extension.events.addListener('enable', this);
				this.toBeUninstalled = false;
				this.toBeDisabled = false;
				this.onuninstalled = aArguments.onuninstalled;
				this.ondisabled = aArguments.ondisabled;
			}

			ObserverService.addObserver(this, 'quit-application', false);
		},

		destroy : function()
		{
			if (this.extension) {
				this.extension.events.removeListener('uninstall', this);
				this.extension.events.removeListener('cancel', this);
				this.extension.events.removeListener('disable', this);
				this.extension.events.removeListener('enable', this);
				delete this.extension;
			}

			if (this.toBeUninstalled && this.onuninstalled)
				this.onuninstalled();
			delete this.onuninstalled;

			if (this.toBeDisabled && this.ondisabled)
				this.ondisabled();
			delete this.ondisabled;

			ObserverService.removeObserver(this, 'quit-application');
		}
	};
})();
