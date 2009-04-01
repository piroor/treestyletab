/*
 lisence: The MIT License, Copyright (c) 2009 SHIMODA "Piro" Hiroshi
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/license.txt
 original:
   https://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/boxObject.js
*/
(function() {
	const currentRevision = 2;

	if (!('piro.sakura.ne.jp' in window)) window['piro.sakura.ne.jp'] = {};

	var loadedRevision = 'boxObject' in window['piro.sakura.ne.jp'] ?
			window['piro.sakura.ne.jp'].boxObject.revision :
			0 ;
	if (loadedRevision && loadedRevision > currentRevision) {
		return;
	}

	var Ci = Components.interfaces;

	window['piro.sakura.ne.jp'].boxObject = {
		revision : currentRevision,

		getBoxObjectFor : function(aNode, aUnify)
		{
			return ('getBoxObjectFor' in aNode.ownerDocument) ?
					this.getBoxObjectFromBoxObjectFor(aNode, aUnify) :
					this.getBoxObjectFromClientRectFor(aNode, aUnify) ;
		},

		getBoxObjectFromBoxObjectFor : function(aNode, aUnify)
		{
			var boxObject = aNode.ownerDocument.getBoxObjectFor(aNode);
			var box = {
					x       : boxObject.x,
					y       : boxObject.y,
					width   : boxObject.width,
					height  : boxObject.height,
					screenX : boxObject.screenX,
					screenY : boxObject.screenY
				};
			if (!aUnify) return box;

			var style = this._getComputedStyle(aNode);
			box.left = box.x - this._getPropertyPixelValue(style, 'border-left-width');
			box.top = box.y - this._getPropertyPixelValue(style, 'border-top-width');
			if (style.getPropertyValue('position') == 'fixed') {
				box.left -= frame.scrollX;
				box.top  -= frame.scrollY;
			}
			box.right  = box.left + box.width;
			box.bottom = box.top + box.height;

			return box;
		},

		getBoxObjectFromClientRectFor : function(aNode, aUnify)
		{
			var box = {
					x       : 0,
					y       : 0,
					width   : 0,
					height  : 0,
					screenX : 0,
					screenY : 0
				};
			try {
				var rect = aNode.getBoundingClientRect();
				if (aUnify) {
					box.left   = rect.left;
					box.top    = rect.top;
					box.right  = rect.right;
					box.bottom = rect.bottom;
				}

				var style = this._getComputedStyle(aNode);
				var frame = aNode.ownerDocument.defaultView;

				// "x" and "y" are offset positions of the "padding-box" from the document top-left edge.
				box.x = rect.left + this._getPropertyPixelValue(style, 'border-left-width');
				box.y = rect.top + this._getPropertyPixelValue(style, 'border-top-width');
				if (style.getPropertyValue('position') != 'fixed') {
					box.x += frame.scrollX;
					box.y += frame.scrollY;
				}

				// "width" and "height" are sizes of the "border-box".
				box.width  = rect.right-rect.left;
				box.height = rect.bottom-rect.top;

				// "screenX" and "screenY" are absolute positions of the "border-box".
				box.screenX = rect.left;
				box.screenY = rect.top;
				var owner = aNode;
				while (true)
				{
					frame = owner.ownerDocument.defaultView;
					owner = this._getFrameOwnerFromFrame(frame);

					let style = this._getComputedStyle(owner);
					box.screenX += this._getPropertyPixelValue(style, 'border-left-width');
					box.screenY += this._getPropertyPixelValue(style, 'border-top-width');

					if (!owner) {
						box.screenX += frame.screenX;
						box.screenY += frame.screenY;
						break;
					}
					if (owner.ownerDocument instanceof Ci.nsIDOMXULDocument) {
						let ownerBox = owner.ownerDocument.getBoxObjectFor(owner);
						box.screenX += ownerBox.screenX;
						box.screenY += ownerBox.screenY;
						break;
					}

					let ownerRect = owner.getBoundingClientRect();
					box.screenX += ownerRect.left;
					box.screenY += ownerRect.top;
				}
			}
			catch(e) {
			}

			for (let i in box)
			{
				box[i] = Math.round(box[i]);
			}

			return box;
		},

		_getComputedStyle : function(aNode)
		{
			return aNode.ownerDocument.defaultView.getComputedStyle(aNode, null);
		},

		_getPropertyPixelValue : function(aStyle, aProperty)
		{
			return parseInt(aStyle.getPropertyValue(aProperty).replace('px', ''));
		},

		_getFrameOwnerFromFrame : function(aFrame)
		{
			var parentItem = aFrame
					.QueryInterface(Ci.nsIInterfaceRequestor)
					.getInterface(Ci.nsIWebNavigation)
					.QueryInterface(Ci.nsIDocShell)
					.QueryInterface(Ci.nsIDocShellTreeNode)
					.QueryInterface(Ci.nsIDocShellTreeItem)
					.parent;
			var isChrome = parentItem.itemType == parentItem.typeChrome;
			var parentDocument = parentItem
					.QueryInterface(Ci.nsIWebNavigation)
					.document;
			var nodes = parentDocument.evaluate(
					'/descendant::*[contains(" frame FRAME iframe IFRAME browser tabbrowser ", concat(" ", local-name(), " "))]',
					parentDocument,
					null,
					XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
					null
				);
			for (let i = 0, maxi = nodes.snapshotLength; i < maxi; i++)
			{
				let owner = nodes.snapshotItem(i);
				if (isChrome && owner.wrappedJSObject) owner = owner.wrappedJSObject;
				if (owner.localName == 'tabbrowser') {
					let tabs = owner.mTabContainer.childNodes;
					for (let i = 0, maxi = tabs.length; i < maxi; i++)
					{
						let browser = tabs[i].linkedBrowser;
						if (browser.contentWindow == aFrame)
							return browser;
					}
				}
				else if (owner.contentWindow == aFrame) {
					return owner;
				}
			}
			return null;
		}

	};
})();
