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

	function free() {
		cleanup =
			Cc = Ci = Cu = Cr =
			TreeStyleTabConstants =
			messageListener =
			handleEvent =
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
		}
	}
	global.addEventListener('selectionchange', handleEvent, true);
})(this);
