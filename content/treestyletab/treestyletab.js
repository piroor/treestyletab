(function() {
	let { ReferenceCounter } = Components.utils.import('resource://treestyletab-modules/ReferenceCounter.js', {});
	/**
	 * On secondary (and later) window, SSWindowStateBusy event can be fired
	 * before DOMContentLoaded, on "domwindowopened".
	 */
	var SSWindowStateBusyListener = function(aEvent) {
			window.removeEventListener(aEvent.type, SSWindowStateBusyListener, false);
			ReferenceCounter.remove('window,aEvent.type,SSWindowStateBusyListener,false');
			window.__treestyletab__WindowStateBusy = true;
			SSWindowStateBusyListener = undefined;
		};
	var SSWindowStateReadyListener = function SSWindowStateReadyListener(aEvent) {
			window.removeEventListener(aEvent.type, SSWindowStateReadyListener, false);
			ReferenceCounter.remove('window,aEvent.type,SSWindowStateReadyListener,false');
			window.__treestyletab__WindowStateReady = true;
			SSWindowStateReadyListener = undefined;
		};
	window.addEventListener('SSWindowStateBusy', SSWindowStateBusyListener, false);
	ReferenceCounter.add('window,SSWindowStateBusy,SSWindowStateBusyListener,false');
	window.addEventListener('SSWindowStateReady', SSWindowStateReadyListener, false);
	ReferenceCounter.add('window,SSWindowStateReady,SSWindowStateReadyListener,false');
	window.addEventListener('load', function onLoad(aEvent) {
		window.removeEventListener(aEvent.type, onLoad, false);
		ReferenceCounter.remove('window,aEvent.type,onLoad,false');
		if (SSWindowStateBusyListener) {
			window.removeEventListener('SSWindowStateBusy', SSWindowStateBusyListener, false);
			ReferenceCounter.remove('window,SSWindowStateBusy,SSWindowStateBusyListener,false');
			SSWindowStateBusyListener = undefined;
		}
		if (SSWindowStateReadyListener) {
			window.removeEventListener('SSWindowStateReady', SSWindowStateReadyListener, false);
			ReferenceCounter.remove('window,SSWindowStateReady,SSWindowStateReadyListener,false');
			SSWindowStateReadyListener = undefined;
		}
	}, false);
	ReferenceCounter.add('window,aEvent.type,onLoad,false');

	var { TreeStyleTabUtils } = Components.utils.import('resource://treestyletab-modules/utils.js', {});
	window.TreeStyleTabUtils = TreeStyleTabUtils;

	var { TreeStyleTabWindow } = Components.utils.import('resource://treestyletab-modules/window.js', {});
	new TreeStyleTabWindow(window);
})();
