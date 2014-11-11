(function(global) {
	var DEBUG = false;
	function mydump(aMessage) {
		if (DEBUG)
			dump('treestyletab(autohide) content utils: '+aMessage +'\n');
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
			hasPluginArea =
			messageListener =
			serializeMouseEvent =
			handleEvent =
			basicListening =
			advanceListening =
			mydump =
				undefined;
	}

	function hasPluginArea(aFrame) {
		return Boolean(
			aFrame &&
			(
				aFrame.document.querySelector('embed, object') ||
				Array.some(aFrame.frames, hasPluginArea)
			)
		);
	}

	var messageListener = function(aMessage) {
		mydump('CONTENT MESSAGE LISTENED <'+global.content.location+'>');
		mydump(JSON.stringify(aMessage.json));
		switch (aMessage.json.command)
		{
			case TreeStyleTabConstants.COMMAND_SHUTDOWN:
				global.removeMessageListener(TreeStyleTabConstants.MESSAGE_TYPE, messageListener);
				if (basicListening) {
					global.removeEventListener('mousedown', handleEvent, true);
					global.removeEventListener('mouseup', handleEvent, true);
				}
				if (advanceListening) {
					global.removeEventListener('mousemove', handleEvent, true);
				}
				free();
				return;

			case TreeStyleTabConstants.COMMAND_NOTIFY_AUTOHIDE_STATUS:
				if (aMessage.json.params.basicListening && !basicListening) {
					basicListening = true;
					global.addEventListener('mousedown', handleEvent, true);
					global.addEventListener('mouseup', handleEvent, true);
				}
				else if (!aMessage.json.params.basicListening && basicListening) {
					basicListening = false;
					global.removeEventListener('mousedown', handleEvent, true);
					global.removeEventListener('mouseup', handleEvent, true);
				}
				if (aMessage.json.params.advanceListening && !advanceListening) {
					advanceListening = true;
					global.addEventListener('mousemove', handleEvent, true);
				}
				else if (!aMessage.json.params.advanceListening && advanceListening) {
					advanceListening = false;
					global.removeEventListener('mousemove', handleEvent, true);
				}
				return;

			case TreeStyleTabConstants.COMMAND_REQUEST_PLUGIN_AREA_EXISTENCE:
				global.sendAsyncMessage(TreeStyleTabConstants.MESSAGE_TYPE, {
					command   : TreeStyleTabConstants.COMMAND_REPORT_PLUGIN_AREA_EXISTENCE,
					id        : aMessage.json.params.id,
					existence : hasPluginArea(content)
				});
				return;
		}
	};
	global.addMessageListener(TreeStyleTabConstants.MESSAGE_TYPE, messageListener);

	function serializeMouseEvent(aEvent) {
		return {
			targetLocalName         : aEvent.target.localName,
			originalTargetLocalName : (aEvent.originalTarget || aEvent.target).localName,
			altKey                  : aEvent.altKey,
			ctrlKey                 : aEvent.ctrlKey,
			metaKey                 : aEvent.metaKey,
			shiftKey                : aEvent.shiftKey,
			screenX                 : aEvent.screenX,
			screenY                 : aEvent.screenY,
			clientX                 : aEvent.clientX,
			clientY                 : aEvent.clientY
		};
	}

	var basicListening = false;
	var advanceListening = false;
	function handleEvent(aEvent) {
		switch (aEvent.type)
		{
			case 'mousedown':
				global.sendAsyncMessage(TreeStyleTabConstants.MESSAGE_TYPE, {
					command : TreeStyleTabConstants.COMMAND_REPORT_MOUSEDOWN,
					event   : serializeMouseEvent(aEvent)
				});
				break;

			case 'mouseup':
				global.sendAsyncMessage(TreeStyleTabConstants.MESSAGE_TYPE, {
					command : TreeStyleTabConstants.COMMAND_REPORT_MOUSEUP,
					event   : serializeMouseEvent(aEvent)
				});
				break;

			case 'mousemove':
				global.sendAsyncMessage(TreeStyleTabConstants.MESSAGE_TYPE, {
					command : TreeStyleTabConstants.COMMAND_REPORT_MOUSEMOVE,
					event   : serializeMouseEvent(aEvent)
				});
				break;
		}
	}
})(this);
