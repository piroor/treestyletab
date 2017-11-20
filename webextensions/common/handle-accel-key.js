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
        aEvent.keyCode == KeyEvent.DOM_VK_META &&
        !aEvent.altKey &&
        !aEvent.ctrlKey /*&&
        !aEvent.shiftKey*/
      );
    else
      return (
        aEvent.keyCode == KeyEvent.DOM_VK_CONTROL &&
        !aEvent.altKey &&
        !aEvent.metaKey /*&&
        !aEvent.shiftKey*/
      );
  }

  function isAccelKeyUnshiftEvent(aEvent) {
    if (isMac)
      return (
        aEvent.keyCode == KeyEvent.DOM_VK_SHIFT &&
        !aEvent.altKey &&
        !aEvent.ctrlKey &&
        aEvent.metaKey /*&&
        !aEvent.shiftKey*/
      );
    else
      return (
        aEvent.keyCode == KeyEvent.DOM_VK_SHIFT &&
        !aEvent.altKey &&
        aEvent.ctrlKey &&
        !aEvent.metaKey /*&&
        !aEvent.shiftKey*/
      );
  }

  function isCtrlTabEvent(aEvent) {
    if (aEvent.keyCode != KeyEvent.DOM_VK_TAB &&
        aEvent.keyCode != KeyEvent.DOM_VK_SHIFT)
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
    if (isAccelKeyOnlyEvent(aEvent) ||
        isCtrlTabEvent(aEvent))
      browser.runtime.sendMessage({
        type: kCOMMAND_NOTIFY_START_TAB_SWITCH
      });
  }

  function onKeyUp(aEvent) {
    const kCOMMAND_NOTIFY_END_TAB_SWITCH = 'treestyletab:notify-end-tab-switch';
    if (isAccelKeyOnlyEvent(aEvent) ||
        (!isAccelKeyUnshiftEvent(aEvent) &&
         !isCtrlTabEvent(aEvent)))
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
