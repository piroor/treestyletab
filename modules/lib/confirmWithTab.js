/**
 * @fileOverview Tab Related Confirmation Library for Firefox 3.5 or later
 * @author       SHIMODA "Piro" Hiroshi
 * @version      5
 * Basic usage:
 *
 * @example
 *   Components.utils.import('resource://my-modules/confirmWithTab.js');
 *
 *   var checkbox = {
 *         label   : 'Never ask me',
 *         checked : false
 *       };
 *   
 *   confirmWithTab({
 *     tab      : gBrowser.selectedTab,           // the related tab
 *     label    : 'Ara you ready?',               // the message
 *     value    : 'treestyletab-undo-close-tree', // the internal key (optional)
 *     buttons  : ['Yes', 'No'],                  // button labels
 *     checkbox : checkbox,                       // checkbox definition (optional)
 *     cancelEvents : ['SSTabRestoring']          // events to cancel this deferred (optional)
 *   })
 *   .next(function(aButtonIndex) {
 *     // the next callback receives the index of the clicked button.
 *     switch (aButtonIndex) {
 *       case 0: // Yes
 *         ...
 *         break;
 *       case 1: // No
 *         ...
 *         break;
 *     }
 *     // after the notification bar is closed, "checked" indicates
 *     // the state of the checkbox when the user clicks a button.
 *     var checked = checkbox.checked;
 *     ...
 *   })
 *   .error(function(aError) {
 *     // if the tab is closed, or any event in the cancelEvents array
 *     // is fired, then an exception is raised.
 *     ...
 *   });
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
	const currentRevision = 5;

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
		if (!aOptions.buttons) {
			return deferred
					.next(function() {
						throw new Error('confirmWithTab requires one or more buttons!');
					});
		}

		aOptions.cancelEvents = (aOptions.cancelEvents || [])
									.concat(['TabClose'])
									.sort()
									.join('\n')
									.replace(/^(.+)$\n(\1\n)+/gm, '$1\n')
									.split('\n');

		var tab = aOptions.tab;
		var b = getTabBrowserFromChild(tab);
		var box = b.getNotificationBox(tab.linkedBrowser);
		var accessKeys = [];
		var numericAccessKey = 0;
		var notification = box.appendNotification(
				aOptions.label,
				aOptions.value || 'confirmWithTab-'+encodeURIComponent(aOptions.label),
				aOptions.image || null,
				(aOptions.priority ?
					(typeof aOptions.priority == 'number' ? aOptions.priority : box[aOptions.priority] ) :
					box.PRIORITY_INFO_MEDIUM
				),
				aOptions.buttons.map(function(aLabel, aIndex) {
					var accessKey;
					var match = aLabel.match(/\s*\(&([0-9a-z])\)/i);
					if (match) {
						accessKey = match[1];
						aLabel = aLabel.replace(match[0], '');
					}
					else {
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
				if (aEvent.type == 'DOMNodeRemoved' && aEvent.target != notification)
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
