/**
 * @fileOverview Tab Related Confirimation Library for Firefox 3.5 or later
 * @author       SHIMODA "Piro" Hiroshi
 * @version      1
 *
 * @license
 *   The MIT License, Copyright (c) 2010 SHIMODA "Piro" Hiroshi
 *   http://github.com/piroor/fxaddonlibs/blob/master/license.txt
 * @url http://github.com/piroor/fxaddonlibs/blob/master/confirmWithTab.js
 * @url http://github.com/piroor/fxaddonlibs
 */

if (typeof window == 'undefined')
	this.EXPORTED_SYMBOLS = ['confirmWithTab'];

// var namespace;
if (typeof namespace == 'undefined') {
	// If namespace.jsm is available, export symbols to the shared namespace.
	// See: http://github.com/piroor/fxaddonlibs/blob/master/namespace.jsm
	try {
		let ns = {};
		Components.utils.import('resource://treestyletab-modules/namespace.jsm', ns);
		namespace = ns.getNamespaceFor('piro.sakura.ne.jp');
	}
	catch(e) {
		namespace = (typeof window != 'undefined' ? window : null ) || {};
	}
}

if (typeof namespace.Deferred == 'undefined')
	Components.utils.import('resource://treestyletab-modules/jsdeferred.js', namespace);

var confirmWithTab;
(function() {
	const currentRevision = 1;

	var loadedRevision = 'confirmWithTab' in namespace ?
			namespace.confirmWithTab.revision :
			0 ;
	if (loadedRevision && loadedRevision > currentRevision) {
		confirmWithTab = namespace.confirmWithTab;
		return;
	}

	const Ci = Components.interfaces;

	confirmWithTab = function confirmWithTab(aOptions) 
	{
		var deferred = new namespace.Deferred();

		var tab = aOptions.tab;
		var b = getTabBrowserFromChild(tab);
		var box = b.getNotificationBox(tab.linkedBrowser);
		var notification = box.appendNotification(
				aOptions.label,
				aOptions.value,
				aOptions.image,
				(aOptions.priority ?
					(typeof aOptions.priority == 'number' ? aOptions.priority : box[aOptions.priority] ) :
					box.PRIORITY_INFO_MEDIUM
				),
				aOptions.buttons.map(function(aLabel, aIndex) {
					return {
						label : aLabel,
						callback : function() {
							deferred.call(aIndex);
						}
					};
				})
			);

		if (aOptions.checkbox) {
			let checkbox = notification.ownerDocument.createElement('checkbox');
			checkbox.setAttribute('label', aOptions.checkbox.label);
			if (aOptions.checkbox.checked)
				checkbox.setAttribute('checked', 'true');

			let container = notification.ownerDocument.createElement('hbox');
			container.setAttribute('align', 'center');
			container.appendChild(checkbox);

			notification.appendChild(container);

			deferred.next(function(aButtonIndex) {
				aOptions.checkbox.checked = checkbox.checked;
				return aButtonIndex;
			});
		}

		var strip = b.tabContainer || b.mTabContainer;
		var handleEvent = function handleEvent(aEvent) {
				if (aEvent.type == 'DOMNodeRemoved' && !aEvent.target != notification)
					return;
				if (aOptions.cancelEvents)
					aOptions.cancelEvents.forEach(function(aEventType) {
						strip.removeEventListener(aEventType, handleEvent, false);
					});
				if (notification.parentNode)
					notification.parentNode.removeEventListener('DOMNodeRemoved', handleEvent, false);
				if (aEvent.type != 'DOMNodeRemoved')
					notification.close();
				deferred.fail(aEvent);
			};
		if (aOptions.cancelEvents)
			aOptions.cancelEvents.forEach(function(aEventType) {
				strip.addEventListener(aEventType, handleEvent, false);
			});
		notification.parentNode.addEventListener('DOMNodeRemoved', handleEvent, false);

		return deferred;
	};

	function getTabBrowserFromChild(aTabBrowserChild)
	{
		var b = aTabBrowserChild.ownerDocument.evaluate(
				'ancestor::*[local-name()="tabbrowser"] | '+
				'ancestor::*[local-name()="tabs"][@tabbrowser] |'+
				'ancestor::*[local-name()="toolbar"][@id="TabsToolbar"]/descendant::*[local-name()="tabs"]',
				aTabBrowserChild,
				null,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE,
				null
			).singleNodeValue;
		return (b && b.tabbrowser) || b;
	}

	namespace.confirmWithTab = confirmWithTab;
})();
