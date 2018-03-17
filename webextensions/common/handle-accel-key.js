/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

(function() {
  if (window.handleAccelKeyLoaded)
    return;

  const isMac = /^Mac/i.test(navigator.platform);

  function isAccelKeyOnlyEvent(aEvent) {
    if (isMac)
      return (
        aEvent.key == 'Meta' &&
        !aEvent.altKey &&
        !aEvent.ctrlKey /*&&
        !aEvent.shiftKey*/
      );
    else
      return (
        aEvent.key == 'Control' &&
        !aEvent.altKey &&
        !aEvent.metaKey /*&&
        !aEvent.shiftKey*/
      );
  }

  function isAccelKeyUnshiftEvent(aEvent) {
    if (isMac)
      return (
        aEvent.key == 'Shift' &&
        !aEvent.altKey &&
        !aEvent.ctrlKey &&
        aEvent.metaKey /*&&
        !aEvent.shiftKey*/
      );
    else
      return (
        aEvent.key == 'Shift' &&
        !aEvent.altKey &&
        aEvent.ctrlKey &&
        !aEvent.metaKey /*&&
        !aEvent.shiftKey*/
      );
  }

  function isTabSwitchEvent(aEvent) {
    if (!/^(Tab|Shift|PageUp|PageDown)$/.test(aEvent.key))
      return false;
    if (isMac)
      return (
        !aEvent.altKey &&
        !aEvent.ctrlKey &&
        aEvent.metaKey /*&&
        !aEvent.shiftKey*/
      );
    else
      return (
        !aEvent.altKey &&
        aEvent.ctrlKey &&
        !aEvent.metaKey /*&&
        !aEvent.shiftKey*/
      );
  }

  function onKeyDown(aEvent) {
    const kCOMMAND_NOTIFY_START_TAB_SWITCH = 'treestyletab:notify-start-tab-switch';
    //console.log('onKeyDown '+JSON.stringify({
    //  accelKeyOnlyEvent: isAccelKeyOnlyEvent(aEvent),
    //  tabSwitchEvent: isTabSwitchEvent(aEvent)
    //}));
    if (isAccelKeyOnlyEvent(aEvent) ||
        isTabSwitchEvent(aEvent))
      browser.runtime.sendMessage({
        type: kCOMMAND_NOTIFY_START_TAB_SWITCH
      });
  }

  function onKeyUp(aEvent) {
    const kCOMMAND_NOTIFY_END_TAB_SWITCH = 'treestyletab:notify-end-tab-switch';
    //console.log('onKeyUp '+JSON.stringify({
    //  accelKeyOnlyEvent: isAccelKeyOnlyEvent(aEvent),
    //  unshiftEvent: isAccelKeyUnshiftEvent(aEvent),
    //  tabSwitchEvent: isTabSwitchEvent(aEvent)
    //}));
    if (isAccelKeyOnlyEvent(aEvent) ||
        (!isAccelKeyUnshiftEvent(aEvent) &&
         !isTabSwitchEvent(aEvent)))
      browser.runtime.sendMessage({
        type: kCOMMAND_NOTIFY_END_TAB_SWITCH
      });
  }

  function init() {
    window.handleAccelKeyLoaded = true;
    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    window.addEventListener('pagehide', () => {
      window.addEventListener('keydown', onKeyDown, { capture: true });
      window.addEventListener('keyup', onKeyUp, { capture: true });
      window.addEventListener('pageshow', init, { once: true });
    }, { once: true });
  }
  init();
})();
