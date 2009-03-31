/*
 lisence: The MIT License, Copyright (c) 2009 SHIMODA "Piro" Hiroshi
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/license.txt
 original:
   https://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/boxObject.js
*/
(function() {
	const currentRevision = 1;

	if (!('piro.sakura.ne.jp' in window)) window['piro.sakura.ne.jp'] = {};

	var loadedRevision = 'boxObject' in window['piro.sakura.ne.jp'] ?
			window['piro.sakura.ne.jp'].boxObject.revision :
			0 ;
	if (loadedRevision && loadedRevision > currentRevision) {
		return;
	}

	var Ci = Components.interfaces;

	var getFrameOwnerFromFrame = function(aFrame) {
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
	};

	window['piro.sakura.ne.jp'].boxObject = {
		revision : currentRevision,

		getBoxObjectFor : function(aNode)
		{
			if ('getBoxObjectFor' in aNode.ownerDocument)
				return aNode.ownerDocument.getBoxObjectFor(aNode);

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
				var frame = aNode.ownerDocument.defaultView;
				box.x = rect.left + frame.scrollX;
				box.y = rect.top + frame.scrollY;
				box.width  = rect.right-rect.left;
				box.height = rect.bottom-rect.top;

				box.screenX = rect.left;
				box.screenY = rect.top;
				var owner = aNode;
				while (true)
				{
					frame = owner.ownerDocument.defaultView;
					owner = getFrameOwnerFromFrame(frame);
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
			return box;
		}

	};
})();
