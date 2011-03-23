/*
 Stop Rendering Library

 Usage:
   window['piro.sakura.ne.jp'].stopRendering.stop();
   // do something
   window['piro.sakura.ne.jp'].stopRendering.start();

 license: The MIT License, Copyright (c) 2009-2011 SHIMODA "Piro" Hiroshi
   http://github.com/piroor/fxaddonlibs/blob/master/license.txt
 original:
   http://github.com/piroor/fxaddonlibs/blob/master/stopRendering.js
*/
(function() {
	const currentRevision = 10;

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

	const Cc = Components.classes;
	const Ci = Components.interfaces;

	window['piro.sakura.ne.jp'].stopRendering = {
		revision : currentRevision,

		_stopLevel : 0,
		_listening : false,

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
			if (this.useCanvas) {
				this.showCanvas();
			}
			else {
				this.baswWindow.setPosition(window.top.innerWidth * 3, window.top.innerHeight * 3);
				if (!this._listening) {
					window.addEventListener('mousedown', this, true);
					this._listening = true;
				}
			}
			this._stopLevel++;
		},

		start : function()
		{
			this._stopLevel--;
			if (this._stopLevel > 0)
				return;

			if (this._listening) {
				window.removeEventListener('mousedown', this, true);
				this._listening = false;
			}

			this._stopLevel = 0;

			if (this.useCanvas) {
				this.hideCanvas();
			}
			else {
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
			}
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

				case 'mousedown':
					this._stopLevel = 0;
					this.hideCanvas();
					aEvent.stopPropagation();
					aEvent.preventDefault();
					return;

				case 'DOMContentLoaded':
					window.removeEventListener('DOMContentLoaded', this, true);
					this.initCanvas();
					return;
			}
		},

		init : function()
		{
			if (this.useCanvas) {
				window.addEventListener('DOMContentLoaded', this, true);
			}
			else {
				this._popups = [];
				window.addEventListener('popupshown', this, false);
				window.addEventListener('popuphidden', this, false);
			}
			window.addEventListener('resize', this, false);
			window.addEventListener('unload', this, false);
		},

		destroy : function()
		{
			if (this.useCanvas) {
				try {
					window.removeEventListener('DOMContentLoaded', this, true);
				}
				catch(e) {
				}
				this.destroyCanvas();
			}
			else {
				this._popups = [];
				window.removeEventListener('popupshown', this, false);
				window.removeEventListener('popuphidden', this, false);
			}
			window.removeEventListener('resize', this, false);
			window.removeEventListener('unload', this, false);
		},


		// full screen canvas

		useCanvas : (function() {
			const XULAppInfo = Cc['@mozilla.org/xre/app-info;1']
								.getService(Ci.nsIXULAppInfo);
			const comparator = Cc['@mozilla.org/xpcom/version-comparator;1']
								.getService(Ci.nsIVersionComparator);
			return comparator.compare(XULAppInfo.version, '4.0b1') > 0;
		})(),

		BASE_ID : 'piro.sakura.ne.jp-fullScreenCanvas',

		DRAW_WINDOW_FLAGS : Ci.nsIDOMCanvasRenderingContext2D.DRAWWINDOW_DRAW_VIEW |
							Ci.nsIDOMCanvasRenderingContext2D.DRAWWINDOW_DRAW_CARET |
							Ci.nsIDOMCanvasRenderingContext2D.DRAWWINDOW_DO_NOT_FLUSH,
		DRAW_WINDOW_BGCOLOR : 'transparent',

		showCanvas : function() 
		{
			if (this.shown) return;

			var canvas = this.canvas;
			if (!canvas) return;

			this.shown = true;

			var rootBox = document.documentElement.boxObject;
			var canvasW = window.innerWidth;
			var canvasH = window.innerHeight;

			var x = 0,
				y = 0,
				w = canvasW,
				h = canvasH;

			canvas.style.width  = (canvas.width = canvasW)+'px';
			canvas.style.height = (canvas.height = canvasH)+'px';
			try {
				var ctx = canvas.getContext('2d');
				ctx.clearRect(0, 0, canvasW, canvasH);
				ctx.save();
				ctx.translate(x, y);
				ctx.drawWindow(window, x, y, w, h, this.DRAW_WINDOW_BGCOLOR, this.DRAW_WINDOW_FLAGS);
				ctx.restore();

				this.browsers.forEach(function(aBrowser) {
					try {
						var b = aBrowser;
						if (b.localName == 'subbrowser') b = b.browser;
						var frame = b.contentWindow;
						var box = (b.localName == 'tabbrowser' ? b.mCurrentBrowser : b ).boxObject;
						var x = box.x;
						var y = box.y;
						var bw = box.width;
						var bh = box.height;
						var w = frame.innerWidth;
						var h = frame.innerHeight;
						ctx.save();
						ctx.translate(x, y);
						ctx.scale(bw / w, bh / h);
						ctx.drawWindow(frame, 0, 0, w, h, this.DRAW_WINDOW_BGCOLOR, this.DRAW_WINDOW_FLAGS);
						ctx.restore();
					}
					catch(e) {
					}
				}, this);

				document.documentElement.setAttribute('fullScreenCanvas-state', 'shown');
			}
			catch(e) {
				this.hideCanvas();
			}
		},
		shown : false,

		hideCanvas : function()
		{
			if (!this.shown) return;

			document.documentElement.removeAttribute('fullScreenCanvas-state');
			this.shown = false;
		},


		get browsers()
		{
			browsers = [].concat(Array.slice(document.getElementsByTagName('tabbrowser')))
						.concat(Array.slice(document.getElementsByTagName('browser')));
			if ('SplitBrowser' in window) browsers = browsers.concat(SplitBrowser.browsers);
			return browsers;
		},

		initCanvas : function()
		{
			var canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
			canvas.setAttribute('id', this.BASE_ID+'-canvas');
			canvas.setAttribute('width', '0');
			canvas.setAttribute('height', '0');
			canvas.setAttribute('style', 'width:0;height:0;');
			this.canvas = canvas;

			var style = document.createProcessingInstruction('xml-stylesheet',
					'type="text/css" href="data:text/css,'+encodeURIComponent(
					[
						':root[fullScreenCanvas-state="shown"] > *:not(#%BASE_ID%-box) {',
						'	visibility: hidden !important;',
						'}',
						'#%BASE_ID%-box {',
						'	position: fixed;',
						'	z-index: 65000;',
						'	top: 0;',
						'	left: 0;',
						'	visibility: collapse;',
						'}',
						':root[fullScreenCanvas-state="shown"] > #%BASE_ID%-box {',
						'	visibility: visible;',
						'}'
					].join('\n').replace(/%BASE_ID%/g, this.BASE_ID.replace(/\./g, '\\.'))
					)+'"'
				);
			this.style = style;

			var box = document.createElement('box');
			box.setAttribute('id', this.BASE_ID+'-box');
			box.setAttribute('onmousedown', 'window["piro.sakura.ne.jp"].stopRendering.handleEvent(event);');
			this.box = box;

			box.appendChild(canvas);
			document.insertBefore(style, document.documentElement);
			document.documentElement.appendChild(box);
		},

		destroyCanvas : function()
		{
			if (!this.canvas)
				return;

			document.documentElement.removeChild(this.box);
			this.box = null;
			this.canvas = null;
			document.removeChild(this.style);
			this.style = null;
		}
	};

	window['piro.sakura.ne.jp'].stopRendering.init();
})();
