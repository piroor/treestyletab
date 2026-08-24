/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

// This is the base class of implementations to show custom UI on contents.

// This script can be loaded in three ways:
//  * REGULAR case:
//    loaded into a public webpage
//  * SIDEBAR case:
//    loaded into the TST sidebar

export default class InContentPanel {
  static TYPE = 'in-content-panel';
  get type() {
    return this.constructor.TYPE;
  }

  panel;
  root;
  windowId; // for SIDEBAR case

  // -moz-platform @media rules looks unavailable on Web contents...
  isWindows = /^Win/i.test(navigator.platform);
  isLinux = /Linux/i.test(navigator.platform);
  isMac = /^Mac/i.test(navigator.platform);

  get styleRules() {
    return `
      .in-content-panel-root {
        --in-content-panel-show-hide-animation: opacity 0.1s ease-out;
        --in-content-panel-scale: 1; /* Web contents may be zoomed by the user, and we need to cancel the zoom effect. */
        --base-panel-width: ${this.BASE_PANEL_WIDTH};
        --max-panel-width: 100%;
        --max-32bit-integer: 2147483647;
        --dimension-relative-050: 0.5em/*rem // We must avoid using "rem", because it refers the font size of the root element and it can be changed by the web page author, for example extremely large value, and it will break the layout of the in-content UI. */;
        --space-small: var(--dimension-relative-050);
        --border-radius-xsmall: 4px;
        --border-radius-large: 16px;
        background: transparent;
        border: 0 none;
        bottom: auto;
        font: Message-Box;
        height: 0px;
        left: 0;
        opacity: 1;
        overflow: hidden;
        position: fixed;
        right: 0;
        top: 0;
        transition: var(--in-content-panel-show-hide-animation);
        width: 100%;
        z-index: var(--max-32bit-integer);

        .in-content-panel {
          /* https://searchfox.org/mozilla-central/rev/dfaf02d68a7cb018b6cad7e189f450352e2cde04/toolkit/themes/shared/popup.css#11-63 */
          color-scheme: light dark;

          /* https://searchfox.org/mozilla-central/rev/126697140e711e04a9d95edae537541c3bde89cc/toolkit/themes/shared/design-system/tokens-shared.css#107 */
          /** Color **/
          --color-blue-20: oklch(83% 0.17 260);
          --color-blue-60: oklch(55% 0.24 260);
          --color-blue-70: oklch(48% 0.2 260);
          --color-blue-80: oklch(41% 0.17 260);
          --color-cyan-10: oklch(90% 0.07 205);
          --color-cyan-20: oklch(83% 0.11 205);
          --color-cyan-30: oklch(76% 0.14 205);
          --color-cyan-70: oklch(48% 0.2 205);
          --color-green-20: oklch(83% 0.14 145);
          --color-green-70: oklch(48% 0.2 145);
          --color-orange-20: oklch(86% 0.14 50);
          --color-orange-70: oklch(48% 0.20 50);
          --color-pink-20: oklch(83% 0.14 360);
          --color-pink-70: oklch(48% 0.2 360);
          --color-purple-20: oklch(83% 0.14 315);
          --color-purple-70: oklch(48% 0.2 315);
          --color-red-20: oklch(83% 0.14 15);
          --color-red-70: oklch(48% 0.2 15);
          --color-white: #ffffff;
          --color-yellow-20: oklch(86% 0.14 90);
          --color-yellow-70: oklch(51% 0.23 90);

          /* https://searchfox.org/mozilla-central/rev/126697140e711e04a9d95edae537541c3bde89cc/toolkit/themes/shared/design-system/tokens-platform.css#31 */
          --color-accent-primary: AccentColor;

          --panel-background: light-dark(Menu, var(--dark-popup));
          --panel-color: light-dark(MenuText, var(--dark-popup-text));
          --panel-padding-block: var(--panel-border-radius);
          --panel-padding-inline: var(--panel-border-radius);
          --panel-padding: var(--panel-padding-block) var(--panel-padding-inline);
          --panel-border-radius: calc(var(--border-radius-xsmall) * var(--in-content-panel-scale));
          /*--panel-border-color: light-dark(ThreeDShadow, var(--dark-popup-border));*/

          &.style-nova {
            --panel-padding-block: calc(var(--space-small) * var(--in-content-panel-scale));
            --panel-padding-inline: calc(var(--space-small) * 3 * var(--in-content-panel-scale));
            --panel-border-radius: calc(var(--border-radius-large) * var(--in-content-panel-scale));
          }

          --panel-shadow-margin: 0px;
          --panel-shadow: 0px 0px var(--panel-shadow-margin) hsla(0,0%,0%,.2);
          -moz-window-input-region-margin: var(--panel-shadow-margin);
          margin: calc(-1 * var(--panel-shadow-margin));

          /* Panel design token theming */
          --background-color-canvas: var(--panel-background);

          /*@media (-moz-platform: linux) {*/
          ${this.isLinux ? '' : '/*'}
            --panel-border-radius: calc(8px * var(--in-content-panel-scale));
            --panel-padding-block: calc(3px * var(--in-content-panel-scale));
            --panel-padding-inline: calc(3px * var(--in-content-panel-scale));

            @media (prefers-contrast) {
              --panel-border-color: color-mix(in srgb, currentColor 60%, transparent);
            }
          ${this.isLinux ? '' : '*/'}
          /*}*/

          /*@media (-moz-platform: linux) or (-moz-platform: windows) {*/
          ${this.isLinux || this.isWindows ? '' : '/*'}
            --panel-shadow-margin: var(--panel-border-radius);
          ${this.isLinux || this.isWindows ? '' : '*/'}
          /*}*/

          /* On some linux WMs we need to draw square menus because alpha is not available */
          @media /*(-moz-platform: linux) and*/ (not (-moz-gtk-csd-transparency-available)) {
            ${this.isLinux ? '' : '/*'}
            --panel-shadow-margin: 0px !important;
            --panel-border-radius: 0px !important;
            ${this.isLinux ? '' : '*/'}
          }

          /*@media (-moz-platform: macos) {*/
          ${this.isMac ? `
            appearance: auto;
            -moz-default-appearance: menupopup;
            background-color: Menu;
            --panel-background: light-dark(white /* https://searchfox.org/mozilla-central/rev/86c208f86f35d53dc824f18f8e540fe5b0663870/browser/themes/shared/browser-colors.css#89 https://searchfox.org/mozilla-central/rev/86c208f86f35d53dc824f18f8e540fe5b0663870/toolkit/themes/shared/global-shared.css#128 */, rgb(66, 65, 77)/* https://searchfox.org/mozilla-central/rev/86c208f86f35d53dc824f18f8e540fe5b0663870/browser/themes/shared/browser-colors.css#89 https://searchfox.org/mozilla-central/rev/86c208f86f35d53dc824f18f8e540fe5b0663870/toolkit/themes/shared/global-shared.css#128 */);
            --panel-border-color: transparent;
            --panel-border-radius: calc(6px * var(--in-content-panel-scale));
          ` : ''}
          /*}*/

          /* https://searchfox.org/mozilla-central/rev/dfaf02d68a7cb018b6cad7e189f450352e2cde04/browser/themes/shared/tabbrowser/tab-hover-preview.css#5 */
          --panel-width: min(var(--max-panel-width), calc(var(--base-panel-width) * var(--in-content-panel-scale)));
          --panel-padding: 0;

          /* https://searchfox.org/mozilla-central/rev/b576bae69c6f3328d2b08108538cbbf535b1b99d/toolkit/themes/shared/global-shared.css#111 */
          /* https://searchfox.org/mozilla-central/rev/b576bae69c6f3328d2b08108538cbbf535b1b99d/browser/themes/shared/browser-colors.css#90 */
          --panel-border-color: light-dark(rgb(240, 240, 244), rgb(82, 82, 94));

          &.style-nova {
            /* https://searchfox.org/mozilla-central/rev/1a4138fff3c97b328b33c107266a461edf83140a/toolkit/themes/shared/design-system/tokens-shared.css */
            --color-blue-20: #a2d3ff;
            --color-blue-30: #7bb2ff;
            --color-blue-50: #455fe7;
            --color-blue-60: #3246b0;
            --color-blue-70: #23327b;
            --color-blue-80: #17214c;
            --color-cyan-10: #c3eef8;
            --color-cyan-20: #8fddf0;
            --color-cyan-30: #4cc4e1;
            --color-cyan-50: #0a809f;
            --color-cyan-60: #066077;
            --color-cyan-70: #034554;
            --color-gray-0: #fbfbfe;
            --color-gray-10: #efedf2;
            --color-gray-20: #d6d5da;
            --color-gray-50: #67666a;
            --color-gray-55: #515054;
            --color-gray-60: #3f3e42;
            --color-gray-65: #312f33;
            --color-gray-70: #252428;
            --color-green-20: #90e3c6;
            --color-green-30: #4acca6;
            --color-green-50: #008865;
            --color-green-60: #06674b;
            --color-green-70: #004933;
            --color-orange-20: #febd99;
            --color-orange-30: #ff9565;
            --color-orange-50: #cd4208;
            --color-orange-60: #9c2c05;
            --color-orange-70: #701c07;
            --color-pink-20: #ffb0e2;
            --color-pink-30: #f585d3;
            --color-pink-50: #b32e9f;
            --color-pink-60: #882078;
            --color-pink-70: #5f1854;
            --color-purple-20: #e8b7ff;
            --color-purple-30: #d490ff;
            --color-purple-50: #9540c8;
            --color-purple-60: #702e98;
            --color-purple-70: #4f216b;
            --color-red-20: #ffb6bf;
            --color-red-30: #ff8998;
            --color-red-50: #c52d4f;
            --color-red-60: #961e3d;
            --color-red-70: #69172d;
            --color-violet-10: #eaddff;
            --color-violet-20: #d4c1ff;
            --color-violet-30: #b89cff;
            --color-violet-50: #764edd;
            --color-violet-60: #5939a8;
            --color-violet-70: #3e2976;
            --color-violet-desaturated-0: #f2f0f8;
            --color-violet-desaturated-20: #d2c8ec;
            --color-violet-desaturated-50: #75669f;
            --color-violet-desaturated-90: #180e30;
            --color-yellow-20: #fbcc77;
            --color-yellow-30: #f3a81e;
            --color-yellow-50: #b26100;
            --color-yellow-60: #854800;
            --color-yellow-70: #5f3100;

            --panel-background: light-dark(var(--color-white), var(--color-gray-70));
            --panel-border-color: light-dark(var(--color-gray-10), var(--color-gray-65));
            --panel-color: light-dark(var(--color-violet-desaturated-90), var(--color-violet-desaturated-0));
          }

          background: var(--panel-background);
          border: var(--panel-border-color) solid calc(1px * var(--in-content-panel-scale));
          border-radius: var(--panel-border-radius);
          box-shadow: var(--panel-shadow);
          box-sizing: border-box;
          color: var(--panel-color);
          direction: ltr;
          font: Message-Box;
          left: auto;
          line-height: 1.5;
          margin-block-start: 0px;
          max-width: var(--panel-width);
          min-width: var(--panel-width);
          opacity: 0;
          padding: 0;
          position: fixed;
          right: auto;
          z-index: var(--max-32bit-integer);

          &.rtl {
            direction: rtl;
          }
          &.animation {
            transition: var(--in-content-panel-show-hide-animation),
                        left 0.1s ease-out,
                        margin-block-start 0.1s ease-out,
                        right 0.1s ease-out;
          }
          &.open {
            opacity: 1;
          }
          &:not(.open) {
            pointer-events: none;
          }

          &.updating,
          & .updating {
            visibility: hidden;
          }
        }

        .in-content-panel-contents {
          max-width: calc(var(--panel-width) - (2px * var(--in-content-panel-scale)));
          min-width: calc(var(--panel-width) - (2px * var(--in-content-panel-scale)));
        }

        .in-content-panel-contents {
          max-height: calc(var(--panel-max-height) - (2px * var(--in-content-panel-scale)));
        }
      }
    `;
  }

  constructor(givenRoot, ...args) {
    this.lastTimestamp = 0;
    this.lastTimestampFor = new Map();
    this.logging = false;

    this.BASE_PANEL_WIDTH  = '280px';

    try {
      this.init(givenRoot, ...args);

      browser.runtime.sendMessage({
        type: `treestyletab:${this.type}:ready`,
      });
    }
    catch(error) {
      console.log('TST In Content Panel fatal error: ', error);
      this.root = this.onMessageSelf = this.destroySelf = null;
    }
  }
  init(givenRoot) { // this can be overridden by subclasses
    this.destroySelf = this.destroy.bind(this);
    this.onMessageSelf = this.onMessage.bind(this);

    this.root = givenRoot || document.documentElement;
    this.root.classList.add('in-content-panel-root');

    const style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.textContent = this.styleRules;
    this.root.appendChild(style);

    browser.runtime.onMessage.addListener(this.onMessageSelf);
    window.addEventListener('unload', this.destroySelf, { once: true });
    window.addEventListener('pagehide', this.destroySelf, { once: true });
  }

  log(...messages) {
    if (this.logging)
      console.log(...messages);
  }

  async onBeforeShow(_message, _sender) {} // this can be overridden by subclasses

  onMessage(message, sender) {
    if (this.windowId &&
        message?.windowId != this.windowId)
      return;

    if (message && 'logging' in message)
      this.logging = !!(message.logging);
    this.log(`${message.type}: `, message);

    switch (message?.type) {
      case `treestyletab:${this.type}:show`:
        return (async () => {
          await this.onBeforeShow(message, sender);
          if (message.timestamp < this.lastTimestamp ||
              message.timestamp < (this.lastTimestampFor.get(message.targetId) || 0)) {
            this.log(`${this.type} show ${message.targetId}: expired, give up to show/update `, message.timestamp);
            return true;
          }
          this.log(`${this.type} show ${message.targetId}: invoked, let's show/update `, message.timestamp);
          this.lastTimestamp = message.timestamp;
          this.lastTimestampFor.set(message.targetId, message.timestamp);
          this.style = message.style;
          this.prepareUI();
          this.updateUI(message);
          this.panel.classList.add('open');
          return true;
        })();

      case `treestyletab:${this.type}:hide`:
        return (async () => {
          // Ensure the order of messages: "show" for new target =>
          // "hide" for previous target.
          await new Promise(requestAnimationFrame);
          if (!this.panel ||
              (message.targetId &&
               this.panel.dataset.targetId != message.targetId)) {
            this.log(`${this.type} hide ${message.targetId}: already hidden, nothing to do `, message.timestamp);
            if (!this.panel && !message.targetId) { // on initial case
              this.lastTimestamp = message.timestamp;
            }
            if (message.targetId) {
              this.lastTimestampFor.set(message.targetId, message.timestamp);
            }
            return;
          }
          if (message.timestamp < this.lastTimestamp ||
              (message.targetId &&
               message.timestamp < (this.lastTimestampFor.get(message.targetId) || 0))) {
            this.log(`${this.type} hide ${message.targetId}: expired, give up to hide `, message.timestamp);
            return true;
          }
          this.log(`${this.type} hide ${message.targetId}: invoked, let's hide  `, message.timestamp);
          this.lastTimestamp = message.timestamp;
          if (message.targetId) {
            this.lastTimestampFor.set(message.targetId, message.timestamp);
          }
          this.hide();
          return true;
        })();

      case 'treestyletab:notify-sidebar-closed':
        if (this.panel) {
          this.hide();
        }
        break;
    }
  }

  onBeforeDestroy() {} // this can be overridden by subclasses

  destroy() {
    this.onBeforeDestroy();

    if (!this.onMessageSelf)
      return;

    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }

    browser.runtime.onMessage.removeListener(this.onMessageSelf);
    window.removeEventListener('unload', this.destroySelf);
    window.removeEventListener('pagehide', this.destroySelf);

    this.lastTimestampFor.clear();
    this.root = this.onMessageSelf = this.destroySelf = null;
  }

  // H.3.
  async hide() {
    if (!this.panel)
      return;

    this.panel.classList.remove('open');

    if (this.panel.classList.contains('animation')) {
      await new Promise((resolve, _reject) => {
        this.panel.addEventListener('transitionend', resolve, { once: true });
      });
    }

    // H.4.
    browser.runtime.sendMessage({
      type: `treestyletab:${this.type}:notify-panel-hidden`,
    });
  }

  get UISource() { // this can be overridden by subclasses
    return '';
  }

  prepareUI() {
    if (this.panel) {
      return;
    }
    this.root.insertAdjacentHTML('beforeend', `
      <div class="in-content-panel">
        <div class="in-content-panel-contents">
          <div class="in-content-panel-contents-inner-box">
            ${this.UISource}
          </div>
        </div>
      </div>
    `.trim().replace(/>\s+</g, '><'));
    this.panel = this.root.querySelector('.in-content-panel');
  }

  onUpdateUI() {} // this can be overridden by subclasses
  onBeforeCompleteUpdate() {} // this can be overridden by subclasses
  onCompleteUpdate() {} // this can be overridden by subclasses
  onShown() {} // this can be overridden by subclasses

  updateUI({ targetId, anchorTabRect, offsetTop, align, rtl, scale, style, animation, backgroundColor, borderColor, color, widthInOuterWorld, fixedOffsetTop, ...params }) {
    this.root.classList.toggle('in-sidebar', this.inSidebar);

    if (!this.panel)
      return;

    const startAt = this.lastStartedAt = Date.now();

    this.log(`${this.type} updateUI `, { panel: this.panel, targetId, anchorTabRect, offsetTop, align, rtl, scale, style, widthInOuterWorld, fixedOffsetTop });

    this.panel.classList.add('updating');
    this.panel.classList.add('updating');
    this.panel.classList.toggle('style-nova', style == 'nova');
    this.panel.classList.toggle('style-proton', style != 'nova');

    if (backgroundColor) {
      this.panel.style.setProperty('--panel-background', backgroundColor);
    }
    if (borderColor) {
      this.panel.style.setProperty('--panel-border-color', borderColor);
    }
    if (color) {
      this.panel.style.setProperty('--panel-color', color);
    }

    // This cancels the zoom effect by the user.
    // We need to calculate the scale with two devicePixelRatio values
    // from both the sidebar and the content area, because all contents
    // of the browser window can be scaled on a high-DPI display by the
    // platform.
    const isResistFingerprintingMode = window.mozInnerScreenY == window.screenY;
    const devicePixelRatio = window.devicePixelRatio; // ((widthInOuterWorld || window.innerWidth) / window.innerWidth);
    this.log(`${this.type} updateUI: isResistFingerprintingMode `, isResistFingerprintingMode, { devicePixelRatio });
    // But window.devicePixelRatio is not available if privacy.resistFingerprinting=true,
    // thus we need to calculate it based on tabs.Tab.width.
    scale = (scale || 1) / devicePixelRatio;
    this.root.style.setProperty('--in-content-panel-scale', scale);
    this.root.style.setProperty('--max-panel-width', `${window.innerWidth}px`);

    const offsetFromWindowEdge = isResistFingerprintingMode ?
      0 :
      (window.mozInnerScreenY - window.screenY) / scale;
    const sidebarContentsOffset = isResistFingerprintingMode ?
      (fixedOffsetTop || 0) :
      (offsetTop - offsetFromWindowEdge) * scale;

    if (anchorTabRect) {
      const panelTopEdge = this.windowId ? anchorTabRect.bottom : anchorTabRect.top;
      const panelBottomEdge = this.windowId ? anchorTabRect.bottom : anchorTabRect.top;
      const panelMaxHeight = Math.max(window.innerHeight - panelTopEdge - sidebarContentsOffset, panelBottomEdge);
      this.panel.style.maxHeight = `${panelMaxHeight}px`;
      this.panel.style.setProperty('--panel-max-height', `${panelMaxHeight}px`);
      this.log('updateUI: limit panel height to ', this.panel.style.maxHeight, { anchorTabRect, maxHeight: window.innerHeight, sidebarContentsOffset, offsetFromWindowEdge });
    }

    this.panel.classList.toggle('rtl', !!rtl);

    this.panel.dataset.targetId = targetId;
    if (align)
      this.panel.dataset.align = align;

    const complete = () => {
      if (complete.completed) {
        return;
      }

      this.onBeforeCompleteUpdate({ complete });

      if (this.panel.dataset.targetId != targetId ||
          this.lastStartedAt != startAt)
        return;

      if (!anchorTabRect) {
        this.panel.classList.remove('updating');
        this.log(`${this.type} updateUI/complete: no tab rect, no need to update the position`);
        return;
      }

      const panelBox = this.panel.getBoundingClientRect();
      if (!panelBox.height &&
          complete.retryCount++ < 10) {
        this.log(`${this.type} updateUI/complete: panel size is zero, retrying `, complete.retryCount);
        requestAnimationFrame(complete);
        return;
      }

      complete.completed = true;

      this.onCompleteUpdate();

      const maxY = window.innerHeight;
      const panelHeight = panelBox.height;

      let top;
      if (this.inSidebar) {
        this.log(`${this.type} updateUI/complete: in-sidebar, alignment calculating: `, { half: window.innerHeight, maxY, scale, anchorTabRect });
        if (anchorTabRect.top > (window.innerHeight / 2)) { // align to bottom edge of the tab
          top = `${Math.min(maxY, anchorTabRect.bottom * scale) - panelHeight - anchorTabRect.height}px`;
          this.log(`${this.type}  => align to bottom edge of the tab, top=`, top);
        }
        else { // align to top edge of the tab
          top = `${Math.max(0, anchorTabRect.top * scale) + anchorTabRect.height}px`;
          this.log(`${this.type}  => align to top edge of the tab, top=`, top);
        }

        this.log(`${this.type}  => top=`, top);
      }
      else { // in-content
        // We need to shift the position with the height of the sidebar header.
        const alignToTopPosition = Math.max(0, anchorTabRect.top * scale) + sidebarContentsOffset;
        const alignToBottomPosition = Math.min(maxY, (anchorTabRect.bottom * scale) + sidebarContentsOffset) - panelHeight;

        this.log(`${this.type} updateUI/complete: in-content, alignment calculating: `, { offsetFromWindowEdge, sidebarContentsOffset, alignToTopPosition, panelHeight, maxY, scale });
        if (alignToTopPosition + panelHeight >= maxY &&
            alignToBottomPosition >= 0) { // align to bottom edge of the tab
          top = `${alignToBottomPosition}px`;
          this.log(`${this.type}  => align to bottom edge of the tab, top=`, top);
        }
        else { // align to top edge of the tab
          top = `${alignToTopPosition}px`;
          this.log(`${this.type}  => align to top edge of the tab, top=`, top);
        }
      }
      // updateUI() may be called multiple times for a target tab
      // (with/without previewURL), so we should not set positions again
      // if not needed. Otherwise the animation may be canceled in middle.
      if (top &&
          this.panel.style.top != top) {
        this.panel.style.top = top;
      }

      let left, right;
      if (align == 'left') {
        left  = 'var(--panel-shadow-margin)';
        right = '';
      }
      else {
        left  = '';
        right = 'var(--panel-shadow-margin)';
      }
      if (this.panel.style.left != left) {
        this.panel.style.left = left;
      }
      if (this.panel.style.right != right) {
        this.panel.style.right = right;
      }

      this.panel.classList.remove('updating');

      this.onShown();
    };
    complete.retryCount = 0;

    const completed = this.onUpdateUI({
      // common args
      align,
      anchorTabRect,
      animation,
      backgroundColor,
      borderColor,
      color,
      fixedOffsetTop,
      offsetTop,
      rtl,
      scale,
      widthInOuterWorld,
      // calculated values
      complete,
      // extra args for subclasses
      ...params,
    });
    if (!completed) {
      complete();
    }
  }

  // for SIDEBAR case
  get inSidebar() {
    return !!this.windowId;
  }

  // for SIDEBAR case
  handleMessage(message) {
    return this.onMessage(message);
  }

  getColors() {
    this.prepareUI();

    const style = window.getComputedStyle(this.panel, null);
    try {
      // Computed style's colors may be unexpected value if the element
      // is not rendered on the screen yet and it has colors for light
      // and dark schemes. So we need to get preferred colors manually.
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return {
        backgroundColor: this.getPreferredColor(style.getPropertyValue('--panel-background'), { isDark }),
        borderColor:     this.getPreferredColor(style.getPropertyValue('--panel-border-color'), { isDark }),
        color:           this.getPreferredColor(style.getPropertyValue('--panel-color'), { isDark }),
      };
    }
    catch(_error) {
    }
    return {
      backgroundColor: style.backgroundColor,
      borderColor:     style.borderColor,
      color:           style.color,
    };
  }

  // Parse light-dark(<light color>, <dark color>) and return preferred color
  getPreferredColor(color, { isDark } = {}) {
    if (!color.startsWith('light-dark('))
      return color;

    const values = [];
    let buffer = '';
    let inParenCount = 0;
    color = color.substring(11); // remove "light-dark(" prefix
    ColorParse:
    for (let i = 0, maxi = color.length; i < maxi; i++) {
      const character = color.charAt(i);
      switch (character) {
        case '(':
          inParenCount++;
          buffer += character;
          break;

        case ')':
          inParenCount--;
          if (inParenCount < 0) {
            values.push(buffer);
            buffer = '';
            break ColorParse;
          }
          buffer += character;
          break;

        case ',':
          if (inParenCount > 0) {
            buffer += character;
          }
          else {
            values.push(buffer);
            buffer = '';
          }
          break;

        default:
          buffer += character;
          break;
      }
    }

    if (typeof isDark != 'boolean')
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return isDark ? values[1] : values[0];
  }
}
