(function() {
	let { ReferenceCounter } = Components.utils.import('resource://treestyletab-modules/ReferenceCounter.js', {});
	/**
	 * On secondary (and later) window, SSWindowStateBusy event can be fired
	 * before DOMContentLoaded, on "domwindowopened".
	 */
	var SSWindowStateBusyListener = function TSTSSWindowStateBusyListener(aEvent) {
			window.removeEventListener(aEvent.type, TSTSSWindowStateBusyListener, false);
			ReferenceCounter.remove('window,aEvent.type,TSTSSWindowStateBusyListener,false');
			window.__treestyletab__WindowStateBusy = true;
			SSWindowStateBusyListener = undefined;
		};
	window.addEventListener('SSWindowStateBusy', SSWindowStateBusyListener, false);
	ReferenceCounter.add('window,SSWindowStateBusy,SSWindowStateBusyListener,false');
	window.addEventListener('DOMContentLoaded', function onDOMContentLoaded(aEvent) {
		window.removeEventListener(aEvent.type, onDOMContentLoaded, false);
		ReferenceCounter.remove('window,aEvent.type,onDOMContentLoaded,false');
		if (SSWindowStateBusyListener) {
			window.removeEventListener('SSWindowStateBusy', SSWindowStateBusyListener, false);
			ReferenceCounter.remove('window,SSWindowStateBusy,SSWindowStateBusyListener,false');
			SSWindowStateBusyListener = undefined;
		}
	}, false);
	ReferenceCounter.add('window,aEvent.type,onDOMContentLoaded,false');

	var { TreeStyleTabUtils } = Components.utils.import('resource://treestyletab-modules/utils.js', {});
	window.TreeStyleTabUtils = TreeStyleTabUtils;

	var { TreeStyleTabWindow } = Components.utils.import('resource://treestyletab-modules/window.js', {});
	new TreeStyleTabWindow(window);
})();
