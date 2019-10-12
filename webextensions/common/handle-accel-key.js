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

  function isAccelKeyOnlyEvent(event) {
    if (isMac)
      return (
        event.key == 'Meta' &&
        !event.altKey &&
        !event.ctrlKey /*&&
        !event.shiftKey*/
      );
    else
      return (
        event.key == 'Control' &&
        !event.altKey &&
        !event.metaKey /*&&
        !event.shiftKey*/
      );
  }

  function isAccelKeyUnshiftEvent(event) {
    if (isMac)
      return (
        event.key == 'Shift' &&
        !event.altKey &&
        !event.ctrlKey &&
        event.metaKey /*&&
        !event.shiftKey*/
      );
    else
      return (
        event.key == 'Shift' &&
        !event.altKey &&
        event.ctrlKey &&
        !event.metaKey /*&&
        !event.shiftKey*/
      );
  }

  function isTabSwitchEvent(event) {
    if (!/^(Tab|Shift|PageUp|PageDown)$/.test(event.key))
      return false;
    if (isMac)
      return (
        !event.altKey &&
        !event.ctrlKey &&
        event.metaKey /*&&
        !event.shiftKey*/
      );
    else
      return (
        !event.altKey &&
        event.ctrlKey &&
        !event.metaKey /*&&
        !event.shiftKey*/
      );
  }

  function onKeyDown(event) {
    const kCOMMAND_NOTIFY_START_TAB_SWITCH = 'treestyletab:notify-start-tab-switch';
    //console.log('onKeyDown '+JSON.stringify({
    //  accelKeyOnlyEvent: isAccelKeyOnlyEvent(event),
    //  tabSwitchEvent: isTabSwitchEvent(event)
    //}));
    if (isAccelKeyOnlyEvent(event) ||
        isTabSwitchEvent(event))
      browser.runtime.sendMessage({
        type: kCOMMAND_NOTIFY_START_TAB_SWITCH
      });
  }

  function onKeyUp(event) {
    const kCOMMAND_NOTIFY_END_TAB_SWITCH = 'treestyletab:notify-end-tab-switch';
    //console.log('onKeyUp '+JSON.stringify({
    //  accelKeyOnlyEvent: isAccelKeyOnlyEvent(event),
    //  unshiftEvent: isAccelKeyUnshiftEvent(event),
    //  tabSwitchEvent: isTabSwitchEvent(event)
    //}));
    if (isAccelKeyOnlyEvent(event) ||
        (!isAccelKeyUnshiftEvent(event) &&
         !isTabSwitchEvent(event)))
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
