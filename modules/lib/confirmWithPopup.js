/**
 * @fileOverview Popup Notification (Door Hanger) Based Confirmation Library for Firefox 4.0 or later
 * @author       SHIMODA "Piro" Hiroshi
 * @version      1
 * Basic usage:
 *
 * @example
 *   Components.utils.import('resource://my-modules/confirmWithPopup.js');
 *
 *   confirmWithPopup({
 *     browser : gBrowser.selectedBrowser,            // the related browser
 *     label   : 'Ara you ready?',                    // the message
 *     value   : 'treestyletab-undo-close-tree',      // the internal key (optional)
 *     anchor  : '....',                              // the ID of the anchor element (optional)
 *     image   : 'chrome://....png',                  // the icon (optional)
 *     buttons : ['Yes', 'Yes forever', 'No forever], // button labels
 *     options : {
 *       // persistence, timeout, persistWhileVisible, dismissed,
 *       // eventCallback, neverShow
 *     }
 *   })
 *   .next(function(aButtonIndex) {
 *     // the next callback receives the index of the clicked button.
 *     switch (aButtonIndex) {
 *       case 0: // Yes
 *         ...
 *         break;
 *       case 1: // Yes forever
 *         ...
 *         break;
 *       case 2: // No forever
 *         ...
 *         break;
 *     }
 *     ...
 *   })
 *   .error(function(aError) {
 *     ...
 *   });
 *
 * @license
 *   The MIT License, Copyright (c) 2011 SHIMODA "Piro" Hiroshi
 *   http://github.com/piroor/fxaddonlibs/blob/master/license.txt
 * @url http://github.com/piroor/fxaddonlibs/blob/master/confirmWithPopup.js
 * @url http://github.com/piroor/fxaddonlibs
 */

if (typeof window == 'undefined')
	this.EXPORTED_SYMBOLS = ['confirmWithPopup'];

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

var available = false;
try {
	Components.utils.import('resource://gre/modules/PopupNotifications.jsm');
	available = true;
}
catch(e) {
}

var confirmWithPopup;
(function() {
	const currentRevision = 1;

	var loadedRevision = 'confirmWithPopup' in namespace ?
			namespace.confirmWithPopup.revision :
			0 ;
	if (loadedRevision && loadedRevision > currentRevision) {
		confirmWithPopup = namespace.confirmWithPopup;
		return;
	}

	if (!available)
		return confirmWithPopup = undefined;

	const DEFAULT_ANCHOR_ICON = 'default-notification-icon';

	function waitImageLoad(aImage, aURI) {
		var deferred = new namespace.Deferred();
		aImage.src = aURI;
		aImage.onload = function() {
			deferred.call(aImage);
		};
		aImage.onerror = function() {
			deferred.call(null);
		};
		return deferred;
	}

	function addStyleSheet(aDocument, aOptions) {
		var uri = 'data:text/css,'+encodeURIComponent(
				'.popup-notification-icon[popupid="'+aOptions.id+'"] {'+
				'	list-style-image: url("'+aOptions.image+'");'+
				(aOptions.width ? 'width: '+aOptions.width+'px;' : '' )+
				(aOptions.height ? 'height: '+aOptions.height+'px;' : '' )+
				'}'+
				'#notification-popup-box[anchorid="'+aOptions.anchor+'"] > #'+aOptions.anchor+' {'+
				'	display: -moz-box;'+
				'}'
			);

		var styleSheets = aDocument.styleSheets;
		for (var i = 0, maxi = styleSheets.length; i < maxi; i++) {
			if (styleSheets[i].href == uri)
				return styleSheets[i].ownerNode;
		}

		var style = aDocument.createProcessingInstruction('xml-stylesheet',
				'type="text/css" href="'+uri+'"'
			);
		aDocument.insertBefore(style, aDocument.documentElement);
		return style;
	}

	confirmWithPopup = function confirmWithPopup(aOptions) 
	{
		var deferred = new namespace.Deferred();
		if (!aOptions.buttons) {
			return deferred
					.next(function() {
						throw new Error('confirmWithPopup requires one or more buttons!');
					});
		}

		var browser = aOptions.browser ?
						aOptions.browser :
					aOptions.tab ?
						aOptions.tab.linkedBrowser :
						null ;
		if (!browser)
			return deferred
					.next(function() {
						throw new Error('confirmWithPopup requires a <xul:browser/>!');
					});

		var doc = browser.ownerDocument;
		var style;
		var imageWidth = aOptions.imageWidth;
		var imageHeight = aOptions.imageHeight;
		var showPopup = function() {
			var accessKeys = [];
			var numericAccessKey = 0;
			var buttons = aOptions.buttons.map(function(aLabel, aIndex) {
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
							else if (!lastUniqueKey &&
									accessKeys.indexOf(possibleAccessKey) < 0) {
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
				});

			var primaryAction = buttons[0];
			var secondaryActions = buttons.length > 1 ? buttons.slice(1) : null ;

			var id = aOptions.value || 'confirmWithPopup-'+encodeURIComponent(aOptions.label);
			var anchor = aOptions.anchor || DEFAULT_ANCHOR_ICON;

			if (aOptions.image)
				style = addStyleSheet(doc, {
					image  : aOptions.image,
					id     : id,
					width  : imageWidth,
					height : imageHeight,
					anchor : anchor
				});

			try {
				/**
				 * 1st try: Prepare the anchor icon. If the icon isn't shown,
				 *          the popup is wrongly positioned to the current tab
				 *          by PopupNotifications.show().
				 */
				doc.defaultView.PopupNotifications.show(
					browser,
					id,
					aOptions.label,
					anchor,
					primaryAction,
					secondaryActions,
					{
						__proto__ : aOptions.options,
						dismissed : true
					}
				);
				if (!aOptions.options || !aOptions.options.dismissed) {
					/**
					 * 2nd try: Show the popup.
					 */
					namespace.Deferred.next(function() {
						doc.defaultView.PopupNotifications.show(
							browser,
							id,
							aOptions.label,
							anchor,
							primaryAction,
							secondaryActions,
							{
								__proto__     : aOptions.options,
								eventCallback : function(aEventType) {
									if (aEventType == 'dismissed')
										deferred.fail(aEventType);
									if (aOptions.options && 
										aOptions.options.eventCallback)
										aOptions.options.eventCallback(aEventType);
								}
							}
						);
					});
				}
			}
			catch(e) {
				deferred.fail(e);
			}
		};

		if (aOptions.image && (!imageWidth || !imageHeight)) {
			waitImageLoad(new doc.defaultView.Image(), aOptions.image)
				.next(function(aImage) {
					imageWidth = aImage.width;
					imageHeight = aImage.height;
				})
				.next(showPopup);
		}
		else {
			namespace.Deferred.next(showPopup);
		}

		return deferred
				.next(function(aButtonIndex) {
					if (doc && style) doc.removeChild(style);
					return aButtonIndex;
				});
	};

	namespace.confirmWithPopup = confirmWithPopup;
})();
