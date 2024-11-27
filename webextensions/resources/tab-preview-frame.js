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
    .tab-preview-container {
      background: Canvas;
      border-radius: 0.5em;
      box-shadow: rgba(0, 0, 0, 0.25) 0.05em 0.05em 0.5em;
      color: CanvasText;
      font: Message-Box;
      left: 0.5em;
      max-width: 20em;
      padding: 0.5em;
      position: fixed;
    }

    .tab-preview-image-wrapper {
      max-height: 10em;
      overflow: hidden;
    }

    .tab-preview-image {
      max-width: 100%;
    }

    .hidden {
      display: none;
    }

    .positioning {
      visibility: hidden;
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
        break;

      case 'treestyletab:hide-tab-preview':
        if (container &&
            container.dataset.tabId == message.tabId) {
          container.parentNode.removeChild(container);
          container = null;
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
  container.dataset.tabId = params.tabId;

  container.querySelector('.tab-preview-title').textContent = params.title;
  container.querySelector('.tab-preview-url').textContent = params.url;

  const preview = container.querySelector('.tab-preview-image');
  preview.src = params.previewURL;
  preview.classList.add('positioning');
  preview.classList.toggle('hidden', !params.previewURL);

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
    preview.classList.remove('positioning');
  });
}

