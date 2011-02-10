/**
 * @fileOverview Tab Related Confirimation Library for Firefox 3.5 or later
 * @author       SHIMODA "Piro" Hiroshi
 * @version      3
 *
 * @license
 *   The MIT License, Copyright (c) 2010-2011 SHIMODA "Piro" Hiroshi
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
		Components.utils.import('resource://treestyletab-modules/lib/namespace.jsm', ns);
		namespace = ns.getNamespaceFor('piro.sakura.ne.jp');
	}
	catch(e) {
		namespace = (typeof window != 'undefined' ? window : null ) || {};
	}
}

// This depends on JSDeferred.
// See: https://github.com/cho45/jsdeferred
if (typeof namespace.Deferred == 'undefined')
	Components.utils.import('resource://treestyletab-modules/lib/jsdeferred.js', namespace);

var confirmWithTab;
(function() {
	const currentRevision = 3;

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
		var accessKeys = [];
		var numericAccessKey = 0;
		var notification = box.appendNotification(
				aOptions.label,
				aOptions.value,
				aOptions.image,
				(aOptions.priority ?
					(typeof aOptions.priority == 'number' ? aOptions.priority : box[aOptions.priority] ) :
					box.PRIORITY_INFO_MEDIUM
				),
				aOptions.buttons.map(function(aLabel, aIndex) {
					var match = aLabel.match(/\s*\(&([0-9a-z])\)/i);
					if (match) {
						accessKey = match[1];
						aLabel = aLabel.replace(match[0], '');
					}
					else {
						let accessKey;
						let lastUniqueKey;
						let sanitizedLabel = [];
						for (let i = 0, maxi = aLabel.length; i < maxi; i++)
						{
							let possibleAccessKey = aLabel.charAt(i);
							if (possibleAccessKey == '&' && i < maxi-1) {
								possibleAccessKey = aLabel.charAt(i+1);
								if (possibleAccessKey != '&') {
									accessKey = possibleAccessKey;
								}
								i++;
							}
							else if (accessKeys.indexOf(possibleAccessKey) < 0) {
								lastUniqueKey = possibleAccessKey;
							}
							sanitizedLabel.push(possibleAccessKey);
						}
						if (!accessKey)
							accessKey = lastUniqueKey;
						if (!accessKey || !/[0-9a-z]/i.test(accessKey))
							accessKey = ++numericAccessKey;

						aLabel = sanitizedLabel.join('');
					}

					accessKeys.push(accessKey);

					return {
						label     : aLabel,
						accessKey : accessKey,
						callback  : function() {
							deferred.call(aIndex);
						}
					};
				})
			);

		var checkbox;
		if (aOptions.checkbox) {
			checkbox = notification.ownerDocument.createElement('checkbox');
			checkbox.setAttribute('label', aOptions.checkbox.label);
			if (aOptions.checkbox.checked)
				checkbox.setAttribute('checked', 'true');

			let container = notification.ownerDocument.createElement('hbox');
			container.setAttribute('align', 'center');
			container.appendChild(checkbox);

			notification.appendChild(container);
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

		return deferred
				.next(function(aButtonIndex) {
					if (aOptions.checkbox)
						aOptions.checkbox.checked = checkbox.checked;
					return aButtonIndex;
				});
	};

	function getTabBrowserFromChild(aTabBrowserChild)
	{
		var b = aTabBrowserChild.ownerDocument.evaluate(
				'ancestor::*[local-name()="tabbrowser"] | '+
				'ancestor::*[local-name()="tabs"][@tabbrowser] |'+
				'ancestor::*[local-name()="toolbar"]/descendant::*[local-name()="tabs"]',
				aTabBrowserChild,
				null,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE,
				null
			).singleNodeValue;
		return (b && b.tabbrowser) || b;
	}

	namespace.confirmWithTab = confirmWithTab;
})();
