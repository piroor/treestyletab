/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

// This is a sub part to show tab preview tooltip.
// See also: /siedbar/tab-preview-tooltip.js

let container = null;

try{
  const style = document.createElement('style');
  style.setAttribute('type', 'text/css');
  style.textContent = `
    :root {
      --show-hide-animation: opacity 0.1s ease-out;
      opacity: 1;
      transition: var(--show-hide-animation);
    }

    :root:hover {
      opacity: 0;
    }

    .tab-preview-container {
      /* https://searchfox.org/mozilla-central/rev/dfaf02d68a7cb018b6cad7e189f450352e2cde04/toolkit/themes/shared/popup.css#11-63 */
      color-scheme: light dark;

      --panel-background: Menu;
      --panel-color: MenuText;
      --panel-padding-block: 4px;
      --panel-padding: var(--panel-padding-block) 0;
      --panel-border-radius: 4px;
      --panel-border-color: ThreeDShadow;
      --panel-width: initial;

      --panel-shadow-margin: 0px;
      --panel-shadow: 0 0 var(--panel-shadow-margin) hsla(0,0%,0%,.2);
      -moz-window-input-region-margin: var(--panel-shadow-margin);
      margin: calc(-1 * var(--panel-shadow-margin));

      /* Panel design token theming */
      --background-color-canvas: var(--panel-background);

      @media (-moz-platform: linux) {
        --panel-border-radius: 8px;
        --panel-padding-block: 3px;

        @media (prefers-contrast) {
          --panel-border-color: color-mix(in srgb, currentColor 60%, transparent);
        }
      }

      @media (-moz-platform: linux) or (-moz-platform: windows) {
        --panel-shadow-margin: 4px;
      }

      /* On some linux WMs we need to draw square menus because alpha is not available */
      @media (-moz-platform: linux) and (not (-moz-gtk-csd-transparency-available)) {
        --panel-shadow-margin: 0px !important;
        --panel-border-radius: 0px !important;
      }

      @media (-moz-platform: macos) {
        appearance: auto;
        -moz-default-appearance: menupopup;
        background-color: Menu;
        --panel-background: none;
        --panel-border-color: transparent;
        --panel-border-radius: 6px;
      }

      /* https://searchfox.org/mozilla-central/rev/dfaf02d68a7cb018b6cad7e189f450352e2cde04/browser/themes/shared/tabbrowser/tab-hover-preview.css#5 */
      --panel-width: 280px;
      --panel-padding: 0;

      /* https://searchfox.org/mozilla-central/rev/dfaf02d68a7cb018b6cad7e189f450352e2cde04/toolkit/themes/shared/design-system/tokens-shared.css#174 */
      --space-xxsmall: calc(0.5 * var(--space-xsmall));
      --space-xsmall: 0.267rem;
      --space-small: calc(2 * var(--space-xsmall));
      --space-medium: calc(3 * var(--space-xsmall));
      --space-large: calc(4 * var(--space-xsmall));
      --space-xlarge: calc(6 * var(--space-xsmall));
      --space-xxlarge: calc(8 * var(--space-xsmall));


      background: var(--panel-background);
      border: var(--panel-border-color) solid 1px;
      border-radius: var(--panel-border-radius);
      box-shadow: var(--panel-shadow);
      color: var(--panel-color);
      font: Message-Box;
      left: var(--panel-shadow-margin);
      max-width: var(--panel-width);
      opacity: 1;
      overflow: hidden; /* clip the preview with the rounded edges */
      padding: var(--panel-border-radius) 0 0;
      position: fixed;
      transition: var(--show-hide-animation);
      width: var(--panel-width);
    }

    .tab-preview-title {
      font-weight: bold;
      line-height: 1.5; /* -webkit-line-clamp looks unavailable, so this is a workaround */
      margin: 0 var(--panel-border-radius) 0.25em;
      max-height: 3em; /* -webkit-line-clamp looks unavailable, so this is a workaround */
      overflow: hidden;
      /* text-overflow: ellipsis; */
      -webkit-line-clamp: 2; /* https://searchfox.org/mozilla-central/rev/dfaf02d68a7cb018b6cad7e189f450352e2cde04/browser/themes/shared/tabbrowser/tab-hover-preview.css#15-18 */
    }

    .tab-preview-url {
      margin: 0 var(--panel-border-radius) 0.25em;
      opacity: 0.69; /* https://searchfox.org/mozilla-central/rev/234f91a9d3ebef0d514868701cfb022d5f199cb5/toolkit/themes/shared/design-system/tokens-shared.css#182 */
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tab-preview-image-wrapper {
      border-top: 1px solid var(--panel-border-color);
      max-height: 140px;
      overflow: hidden;
    }

    .tab-preview-image {
      max-width: 100%;
    }

    .blank {
      display: none;
    }

    .updating,
    .hidden {
      opacity: 0;
    }
  `;
  document.head.appendChild(style);

  browser.runtime.onMessage.addListener((message, _sender) => {
    //console.log('ON MESSAGE IN IFRAME ', message);
    /*
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(message);
    document.body.appendChild(pre);
    */

    switch (message?.type) {
      case 'treestyletab:show-tab-preview':
        if (!container) {
          container = createPreview();
        }
        updatePreview(message, container);
        document.documentElement.appendChild(container);
        container.classList.remove('hidden');
        break;

      case 'treestyletab:hide-tab-preview':
        if (container &&
            container.dataset.tabId == message.tabId) {
          container.classList.add('hidden');
        }
        break;
    }
  });

  document.documentElement.style.pointerEvents = 'none';

  browser.runtime.sendMessage({
    type: 'treestyletab:tab-preview-frame-loaded',
  });
}
catch (error) {
  console.log('TST Tab Preview Frame fatal error: ', error);
}

function createPreview() {
  const container = document.createElement('div');
  container.setAttribute('class', 'tab-preview-container');
  const title = container.appendChild(document.createElement('div'));
  title.setAttribute('class', 'tab-preview-title');
  const url = container.appendChild(document.createElement('div'));
  url.setAttribute('class', 'tab-preview-url');
  const previewWrapper = container.appendChild(document.createElement('div'));
  previewWrapper.setAttribute('class', 'tab-preview-image-wrapper');
  const preview = previewWrapper.appendChild(document.createElement('img'));
  preview.setAttribute('class', 'tab-preview-image');
  return container;
}

function updatePreview(params, container) {
  container.classList.add('updating');

  container.dataset.tabId = params.tabId;

  container.querySelector('.tab-preview-title').textContent = params.title;

  const url = container.querySelector('.tab-preview-url');
  url.textContent = params.url;
  url.classList.toggle('blank', !params.url);

  const preview = container.querySelector('.tab-preview-image');
  preview.src = params.previewURL;
  preview.classList.toggle('blank', !params.previewURL);

  window.requestAnimationFrame(() => {
    if (container.dataset.tabId != params.tabId)
      return;

    const maxY = window.innerHeight;
    const containerHeight = container.getBoundingClientRect().height;
    if (params.tabRect.top + containerHeight >= maxY) {
      container.style.top = `${Math.min(maxY, params.tabRect.bottom) - containerHeight}px`;
    }
    else {
      container.style.top = `${Math.max(0, params.tabRect.top)}px`;
    }
    container.classList.remove('updating');
  });
}

