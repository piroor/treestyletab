(function(global) {
	var DEBUG = false;
	function mydump(aMessage) {
		if (DEBUG)
			dump('treestyletab(general) content utils: '+aMessage +'\n');
	}
	mydump('CONTENT SCRIPT LOADED <'+global.content.location+'>');

	var Cc = Components.classes;
	var Ci = Components.interfaces;
	var Cu = Components.utils;
	var Cr = Components.results;

	var { TreeStyleTabConstants } = Cu.import('resource://treestyletab-modules/constants.js', {});
	var { XPCOMUtils } = Cu.import('resource://gre/modules/XPCOMUtils.jsm', {});

	function free() {
		cleanup =
			Cc = Ci = Cu = Cr =
			TreeStyleTabConstants =
			XPCOMUtils =
			messageListener =
			handleEvent =
			progressListener =
			mydump =
				undefined;
	}

	var messageListener = function(aMessage) {
		mydump('CONTENT MESSAGE LISTENED <'+(global.content && global.content.location)+'>');
		mydump(JSON.stringify(aMessage.json));
		switch (aMessage.json.command)
		{
			case TreeStyleTabConstants.COMMAND_SHUTDOWN:
				global.removeMessageListener(TreeStyleTabConstants.MESSAGE_TYPE, messageListener);
				global.removeEventListener('selectionchange', handleEvent, true);
				global.removeEventListener('DOMContentLoaded', handleEvent, true);
				global.docShell
						.QueryInterface(Ci.nsIInterfaceRequestor)
						.getInterface(Ci.nsIWebProgress)
						.removeProgressListener(progressListener);
				free();
				return;
		}
	};
	global.addMessageListener(TreeStyleTabConstants.MESSAGE_TYPE, messageListener);

	function handleEvent(aEvent) {
		switch (aEvent.type)
		{
			case 'selectionchange':
				if (!aEvent.target ||
					!aEvent.target.getSelection)
					return;
				global.sendAsyncMessage(TreeStyleTabConstants.MESSAGE_TYPE, {
					command : TreeStyleTabConstants.COMMAND_REPORT_SELECTION_CHANGE,
					text    : aEvent.target.getSelection().toString()
				});
				return;

			case 'DOMContentLoaded':
				progressListener.onLocationChange();
				return;
		}
	}
	global.addEventListener('selectionchange', handleEvent, true);
	global.addEventListener('DOMContentLoaded', handleEvent, true);

	var progressListener = {
		// nsIPorgressListener
		onStateChange : function() {},
		onProgressChange : function() {},
		onLocationChange : function(aWebProgress, aRequest, aLocation, aFlags) {
			global.sendAsyncMessage(TreeStyleTabConstants.MESSAGE_TYPE, {
				command   : TreeStyleTabConstants.COMMAND_REPORT_LOCATION_CHANGE,
				locations : this.collectLocations(global.content).map(function(aURI) {
					return this.getHashString(aURI);
				}, this)
			});
		},
		onStatusChange : function() {},
		onSecurityChange : function() {},

		// nsISupports
		QueryInterface : XPCOMUtils.generateQI([
			Ci.nsIWebPorgressListener,
			Ci.nsISupportsWeakReference,
			Ci.nsISupports
		]),

		collectLocations : function(aFrame, aLocations) {
			aLocations = aLocations || {};
			aLocations[aFrame.location.href] = true;
			Array.forEach(aFrame.frames, function(aSubFrame) {
				this.collectLocations(aSubFrame, aLocations);
			}, this);
			return Object.keys(aLocations);
		},
		getHashString : function(aString) {
			let hasher = Cc['@mozilla.org/security/hash;1']
							.createInstance(Ci.nsICryptoHash);
			hasher.init(Ci.nsICryptoHash.MD5);
			let input = Cc['@mozilla.org/io/string-input-stream;1']
							.createInstance(Ci.nsIStringInputStream);
			input.data = aString;
			hasher.updateFromStream(input, -1);
			return hasher.finish(true);
		}
	};
	global.docShell
			.QueryInterface(Ci.nsIInterfaceRequestor)
			.getInterface(Ci.nsIWebProgress)
			.addProgressListener(progressListener, Ci.nsIWebProgress.NOTIFY_LOCATION);
})(this);
