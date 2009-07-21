/*
 Extensions Compatibility Library

 Usage:
   if (window['piro.sakura.ne.jp'].extensions.isInstalled('my.extension.id@example.com') &&
       window['piro.sakura.ne.jp'].extensions.isEnabled('my.extension.id@example.com'))
       window['piro.sakura.ne.jp'].extensions.goToOptions('my.extension.id@example.com');

 lisence: The MIT License, Copyright (c) 2009 SHIMODA "Piro" Hiroshi
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/license.txt
 original:
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/extensions.js
*/
(function() {
	const currentRevision = 1;

	if (!('piro.sakura.ne.jp' in window)) window['piro.sakura.ne.jp'] = {};

	var loadedRevision = 'extensions' in window['piro.sakura.ne.jp'] ?
			window['piro.sakura.ne.jp'].extensions.revision :
			0 ;
	if (loadedRevision && loadedRevision > currentRevision) {
		return;
	}

	window['piro.sakura.ne.jp'].extensions = {
		revision : currentRevision,

		ExtensionManager : Components.classes['@mozilla.org/extensions/manager;1']
			.getService(Components.interfaces.nsIExtensionManager),
		RDF : Components.classes['@mozilla.org/rdf/rdf-service;1']
			.getService(Components.interfaces.nsIRDFService),
		WindowMediator : Components.classes['@mozilla.org/appshell/window-mediator;1']
			.getService(Components.interfaces.nsIWindowMediator),
		Prefs : Components.classes['@mozilla.org/preferences;1']
			.getService(Components.interfaces.nsIPrefBranch),

		isInstalled : function(aId)
		{
			return this.ExtensionManager.getInstallLocation(aId);
		},

		isEnabled : function(aId)
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

		goToOptions : function(aId)
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
		}
	};
})();
