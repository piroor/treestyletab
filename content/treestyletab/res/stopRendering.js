/*
 Stop Rendering Library

 Usage:
   window['piro.sakura.ne.jp'].stopRendering.stop();
   // do something
   window['piro.sakura.ne.jp'].stopRendering.start();

 lisence: The MIT License, Copyright (c) 2009 SHIMODA "Piro" Hiroshi
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/license.txt
 original:
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/stopRendering.js
*/
(function() {
	const currentRevision = 1;

	if (!('piro.sakura.ne.jp' in window)) window['piro.sakura.ne.jp'] = {};

	var loadedRevision = 'stopRendering' in window['piro.sakura.ne.jp'] ?
			window['piro.sakura.ne.jp'].stopRendering.revision :
			0 ;
	if (loadedRevision && loadedRevision > currentRevision) {
		return;
	}

	window['piro.sakura.ne.jp'].stopRendering = {
		revision : currentRevision,

		_stopLevel : 0,

		get rootContentViewer()
		{
			return window
					.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
					.getInterface(Components.interfaces.nsIWebNavigation)
					.QueryInterface(Components.interfaces.nsIDocShell)
					.contentViewer
					.QueryInterface(Components.interfaces.nsIMarkupDocumentViewer);
		},

		stop : function()
		{
			if (!this._stopLevel)
				this.rootContentViewer.hide();
			this._stopLevel++;
		},

		start : function()
		{
			this._stopLevel--;
			if (!this._stopLevel)
				this.rootContentViewer.show();
		}

	};
})();
