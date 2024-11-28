/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

// This is a sub part to show tab preview tooltip.
// See also: /siedbar/tab-preview-tooltip.js

let panel = null;
const windowId = new URL(location.href).searchParams.get('windowId') || null;

try{
  // -moz-platform @media rules looks unavailable on Web contents...
  const isWindows = /^Win/i.test(navigator.platform);
  const isLinux = /Linux/i.test(navigator.platform);
  const isMac = /^Mac/i.test(navigator.platform);

  const style = document.createElement('style');
  style.setAttribute('type', 'text/css');
  style.textContent = `
    :root {
      --show-hide-animation: opacity 0.1s ease-out;
      --device-pixel-ratio: 1;
      opacity: 1;
      transition: var(--show-hide-animation);
    }

    :root:hover {
      opacity: 0;
    }

    .tab-preview-panel {
      /* https://searchfox.org/mozilla-central/rev/dfaf02d68a7cb018b6cad7e189f450352e2cde04/toolkit/themes/shared/popup.css#11-63 */
      color-scheme: light dark;

      --panel-background: Menu;
      --panel-color: MenuText;
      --panel-padding-block: calc(4px / var(--device-pixel-ratio));
      --panel-padding: var(--panel-padding-block) 0;
      --panel-border-radius: calc(4px / var(--device-pixel-ratio));
      --panel-border-color: ThreeDShadow;
      --panel-width: initial;

      --panel-shadow-margin: 0px;
      --panel-shadow: 0px 0px var(--panel-shadow-margin) hsla(0,0%,0%,.2);
      -moz-window-input-region-margin: var(--panel-shadow-margin);
      margin: calc(-1 * var(--panel-shadow-margin));

      /* Panel design token theming */
      --background-color-canvas: var(--panel-background);

      /*@media (-moz-platform: linux) {*/
      ${isLinux ? '' : '/*'}
        --panel-border-radius: calc(8px / var(--device-pixel-ratio));
        --panel-padding-block: calc(3px / var(--device-pixel-ratio));

        @media (prefers-contrast) {
          --panel-border-color: color-mix(in srgb, currentColor 60%, transparent);
        }
      ${isLinux ? '' : '*/'}
      /*}*/

      /*@media (-moz-platform: linux) or (-moz-platform: windows) {*/
      ${isLinux || isWindows ? '' : '/*'}
        --panel-shadow-margin: calc(4px / var(--device-pixel-ratio));
      ${isLinux || isWindows ? '' : '*/'}
      /*}*/

      /* On some linux WMs we need to draw square menus because alpha is not available */
      @media /*(-moz-platform: linux) and*/ (not (-moz-gtk-csd-transparency-available)) {
        ${isLinux ? '' : '/*'}
        --panel-shadow-margin: 0px !important;
        --panel-border-radius: 0px !important;
        ${isLinux ? '' : '*/'}
      }

      /*@media (-moz-platform: macos) {*/
      ${isMac ? '' : '/*'}
        appearance: auto;
        -moz-default-appearance: menupopup;
        background-color: Menu;
        --panel-background: none;
        --panel-border-color: transparent;
        --panel-border-radius: calc(6px / var(--device-pixel-ratio));
      ${isMac ? '' : '*/'}
      /*}*/

      /* https://searchfox.org/mozilla-central/rev/dfaf02d68a7cb018b6cad7e189f450352e2cde04/browser/themes/shared/tabbrowser/tab-hover-preview.css#5 */
      --panel-width: min(100%, calc(280px / var(--device-pixel-ratio)));
      --panel-padding: 0;


      background: var(--panel-background);
      border: var(--panel-border-color) solid calc(1px / var(--device-pixel-ratio));
      border-radius: var(--panel-border-radius);
      box-shadow: var(--panel-shadow);
      color: var(--panel-color);
      font: Message-Box;
      left: auto;
      max-width: var(--panel-width);
      opacity: 1;
      overflow: hidden; /* clip the preview with the rounded edges */
      padding: var(--panel-border-radius) 0 0;
      position: fixed;
      right: auto;
      transition: var(--show-hide-animation);
      width: var(--panel-width);
    }

    .tab-preview-title {
      font-size: calc(1em / var(--device-pixel-ratio));
      font-weight: bold;
      line-height: 1.5; /* -webkit-line-clamp looks unavailable, so this is a workaround */
      margin: 0 var(--panel-border-radius);
      max-height: 3em; /* -webkit-line-clamp looks unavailable, so this is a workaround */
      overflow: hidden;
      /* text-overflow: ellipsis; */
      -webkit-line-clamp: 2; /* https://searchfox.org/mozilla-central/rev/dfaf02d68a7cb018b6cad7e189f450352e2cde04/browser/themes/shared/tabbrowser/tab-hover-preview.css#15-18 */
    }

    .tab-preview-url {
      font-size: calc(1em / var(--device-pixel-ratio));
      margin: 0 var(--panel-border-radius);
      opacity: 0.69; /* https://searchfox.org/mozilla-central/rev/234f91a9d3ebef0d514868701cfb022d5f199cb5/toolkit/themes/shared/design-system/tokens-shared.css#182 */
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tab-preview-image-wrapper {
      border-top: calc(1px / var(--device-pixel-ratio)) solid var(--panel-border-color);
      margin-top: 0.25em;
      max-height: calc(var(--panel-width) / 2); /* use relative value instead of 140px */
      overflow: hidden;
    }

    .tab-preview-image {
      max-width: 100%;
    }

    .blank {
      display: none;
    }

    .hidden {
      opacity: 0;
    }

    .updating {
      visibility: hidden;
    }
  `;
  document.head.appendChild(style);

  let lastTimestamp = 0;
  const onMessage = (message, _sender) => {
    if (windowId &&
        message?.windowId != windowId)
      return;

    //console.log('ON MESSAGE IN IFRAME ', lastTimestamp, message);
    /*
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(message);
    document.body.appendChild(pre);
    */

    switch (message?.type) {
      case 'treestyletab:show-tab-preview':
        if (message.timestamp < lastTimestamp)
          return Promise.resolve(false);
        lastTimestamp = message.timestamp;
        if (!panel) {
          panel = createPanel();
        }
        updatePanel(message);
        document.documentElement.appendChild(panel);
        panel.classList.remove('hidden');
        return Promise.resolve(true);

      case 'treestyletab:hide-tab-preview':
        if (message.timestamp < lastTimestamp)
          return;
        lastTimestamp = message.timestamp;
        if (panel &&
            (!message.tabId ||
             panel.dataset.tabId == message.tabId)) {
          panel.classList.add('hidden');
        }
        break;

      case 'treestyletab:notify-sidebar-closed':
        if (panel) {
          panel.classList.add('hidden');
        }
        break;
    }
  };
  browser.runtime.onMessage.addListener(onMessage);
  window.addEventListener('unload', () => {
    browser.runtime.onMessage.removeListener(onMessage);
  }, { once: true });

  document.documentElement.style.pointerEvents = 'none';

  browser.runtime.sendMessage({
    type: 'treestyletab:tab-preview-frame-loaded',
  });
}
catch (error) {
  console.log('TST Tab Preview Frame fatal error: ', error);
}

function createPanel() {
  const panel = document.createElement('div');
  panel.setAttribute('class', 'tab-preview-panel');
  const title = panel.appendChild(document.createElement('div'));
  title.setAttribute('class', 'tab-preview-title');
  const url = panel.appendChild(document.createElement('div'));
  url.setAttribute('class', 'tab-preview-url');
  const previewWrapper = panel.appendChild(document.createElement('div'));
  previewWrapper.setAttribute('class', 'tab-preview-image-wrapper');
  const preview = previewWrapper.appendChild(document.createElement('img'));
  preview.setAttribute('class', 'tab-preview-image');
  return panel;
}

function updatePanel({ tabId, title, url, previewURL, tabRect, offsetTop, align } = {}) {
  if (!panel)
    return;

  panel.classList.add('updating');

  document.documentElement.style.setProperty('--device-pixel-ratio', window.devicePixelRatio);
  panel.style.setProperty('--panel-width', `calc(min(${window.innerWidth}px, 280px) / var(--device-pixel-ratio))`);

  panel.dataset.tabId = tabId;

  panel.querySelector('.tab-preview-title').textContent = title;

  const urlElement = panel.querySelector('.tab-preview-url');
  urlElement.textContent = url;
  urlElement.classList.toggle('blank', !url);

  const previewImage = panel.querySelector('.tab-preview-image');
  previewImage.src = previewURL;
  previewImage.classList.toggle('blank', !previewURL);

  window.requestAnimationFrame(() => {
    if (panel.dataset.tabId != tabId)
      return;

    const maxY = window.innerHeight / window.devicePixelRatio;
    const panelHeight = panel.getBoundingClientRect().height;

    if (windowId) { // in-sidebar
      if (tabRect.top > (window.innerHeight / 2)) {
        panel.style.top = `${Math.min(maxY, tabRect.bottom / window.devicePixelRatio) - panelHeight - tabRect.height}px`;
      }
      else {
        panel.style.top = `${Math.max(0, tabRect.top / window.devicePixelRatio) + tabRect.height}px`;
      }

      panel.style.left  = 'var(--panel-shadow-margin)';
      panel.style.right = 'var(--panel-shadow-margin)';
    }
    else { // in-content
      // We need to shift the position with the height of the sidebar header.
      const offsetFromWindowEdge = (window.mozInnerScreenY - window.screenY) * window.devicePixelRatio;
      const sidebarContentsOffset = (offsetTop - offsetFromWindowEdge) / window.devicePixelRatio;

      if (tabRect.top / window.devicePixelRatio + panelHeight >= maxY) {
        panel.style.top = `${Math.min(maxY, tabRect.bottom / window.devicePixelRatio) - panelHeight + sidebarContentsOffset}px`;
      }
      else {
        panel.style.top = `${Math.max(0, tabRect.top / window.devicePixelRatio) + sidebarContentsOffset}px`;
      }

      if (align == 'left') {
        panel.style.left  = 'var(--panel-shadow-margin)';
        panel.style.right = '';
      }
      else {
        panel.style.left  = '';
        panel.style.right = 'var(--panel-shadow-margin)';
      }
    }

    panel.classList.remove('updating');
  });
}

