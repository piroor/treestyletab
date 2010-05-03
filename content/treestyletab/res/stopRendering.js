/*
 Stop Rendering Library

 Usage:
   window['piro.sakura.ne.jp'].stopRendering.stop();
   // do something
   window['piro.sakura.ne.jp'].stopRendering.start();

 lisence: The MIT License, Copyright (c) 2009-2010 SHIMODA "Piro" Hiroshi
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/license.txt
 original:
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/stopRendering.js
*/
(function() {
	const currentRevision = 5;

	if (!('piro.sakura.ne.jp' in window)) window['piro.sakura.ne.jp'] = {};

	var loadedRevision = 'stopRendering' in window['piro.sakura.ne.jp'] ?
			window['piro.sakura.ne.jp'].stopRendering.revision :
			0 ;
	if (loadedRevision && loadedRevision > currentRevision) {
		return;
	}

	if (loadedRevision &&
		'destroy' in window['piro.sakura.ne.jp'].stopRendering)
		window['piro.sakura.ne.jp'].stopRendering.destroy();

	const Ci = Components.interfaces;

	window['piro.sakura.ne.jp'].stopRendering = {
		revision : currentRevision,

		_stopLevel : 0,

		get baswWindow()
		{
			return window.top
					.QueryInterface(Ci.nsIInterfaceRequestor)
					.getInterface(Ci.nsIWebNavigation)
					.QueryInterface(Ci.nsIDocShell)
					.QueryInterface(Ci.nsIBaseWindow);
		},

		stop : function()
		{
			this.baswWindow.setPosition(window.top.innerWidth * 3, window.top.innerHeight * 3);
			this._stopLevel++;
		},

		start : function()
		{
			this._stopLevel--;
			if (this._stopLevel > 0)
				return;

			this._stopLevel = 0;
			this.baswWindow.setPosition(0, 0);

			this._popups.forEach(function(aPopup, aIndex) {
				if (aPopup.state != 'open') return;
				var w = aPopup.boxObject.width;
				var h = aPopup.boxObject.height;
				var hasWidth = aPopup.hasAttribute('width');
				var hasHeight = aPopup.hasAttribute('height');
				aPopup.sizeTo(w, h-1);
				aPopup.sizeTo(w, h);
				if (!hasWidth || !hasHeight)
					window.setTimeout(function() {
						if (!hasWidth)
							aPopup.removeAttribute('width');
						if (!hasHeight)
							aPopup.removeAttribute('height');
					}, 0);
			}, this);
		},

		onResize : function(aEvent)
		{
			if (aEvent.target != window || !this._stopLevel)
				return;

			this._stopLevel = 0;
			this.start();
		},


		handleEvent : function(aEvent)
		{
			switch (aEvent.type)
			{
				case 'unload':
					this.destroy();
					return;

				case 'resize':
					this.onResize(aEvent);
					return;

				case 'popupshown':
					let (index = this._popups.indexOf(aEvent.originalTarget)) {
						if (index < 0)
							this._popups.push(aEvent.originalTarget);
					}
					return;

				case 'popuphidden':
					let (index = this._popups.indexOf(aEvent.originalTarget)) {
						if (index > -1)
							this._popups.splice(index, 1);
					}
					return;
			}
		},

		init : function()
		{
			this._popups = [];
			window.addEventListener('resize', this, false);
			window.addEventListener('popupshown', this, false);
			window.addEventListener('popuphidden', this, false);
			window.addEventListener('unload', this, false);
		},

		destroy : function()
		{
			this._popups = [];
			window.removeEventListener('resize', this, false);
			window.removeEventListener('popupshown', this, false);
			window.removeEventListener('popuphidden', this, false);
			window.removeEventListener('unload', this, false);
		}

	};

	window['piro.sakura.ne.jp'].stopRendering.init();
})();
