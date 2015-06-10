(function() {
	/**
	 * On secondary (and later) window, SSWindowStateBusy event can be fired
	 * before DOMContentLoaded, on "domwindowopened".
	 */
	var SSWindowStateBusyListener = function TSTSSWindowStateBusyListener(aEvent) {
			window.removeEventListener(aEvent.type, TSTSSWindowStateBusyListener, false);
			window.__treestyletab__WindowStateBusy = true;
			SSWindowStateBusyListener = undefined;
		};
	window.addEventListener('SSWindowStateBusy', SSWindowStateBusyListener, false);
	window.addEventListener('DOMContentLoaded', function onDOMContentLoaded(aEvent) {
		window.removeEventListener(aEvent.type, onDOMContentLoaded, false);
		if (SSWindowStateBusyListener) {
			window.removeEventListener('SSWindowStateBusy', SSWindowStateBusyListener, false);
			SSWindowStateBusyListener = undefined;
		}
	}, false);

	var ns = {};
	Components.utils.import('resource://treestyletab-modules/window.js', ns);
	new ns.TreeStyleTabWindow(window);
})();
