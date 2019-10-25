/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

import {
  configs
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as TabsStore from '/common/tabs-store.js';

import TabFavIconHelper from '/extlib/TabFavIconHelper.js';

import { kTAB_TWISTY_ELEMENT_NAME } from './TabTwistyElement.js';
import { kTAB_FAVICON_ELEMENT_NAME } from './TabFaviconElement.js';
import { kTAB_LABEL_ELEMENT_NAME } from './TabLabelElement.js';
import { kTAB_COUNTER_ELEMENT_NAME } from './TabCounterElement.js';
import { kTAB_SOUND_BUTTON_ELEMENT_NAME } from './TabSoundButtonElement.js';
import { kTAB_CLOSE_BOX_ELEMENT_NAME } from './TabCloseBoxElement.js';

export const kTAB_ELEMENT_NAME = 'tab-item';

export const TabInvalidationTarget = Object.freeze({
  Twisty:      1 << 0,
  SoundButton: 1 << 1,
  CloseBox:    1 << 2,
  Tooltip:     1 << 3,
  All:         1 << 0 | 1 << 1 | 1 << 2 | 1 << 3,
});

export const TabUpdateTarget = Object.freeze({
  Counter:  1 << 0,
  Overflow: 1 << 1,
  All:      1 << 0 || 1 << 1,
});

const kTAB_CLASS_NAME = 'tab';

export class TabElement extends HTMLElement {
  static define() {
    window.customElements.define(kTAB_ELEMENT_NAME, TabElement);
  }

  constructor() {
    super();
  }

  connectedCallback() {
    if (this.initialized) {
      this.invalidate(TabInvalidationTarget.All);
      this._applyAttributes();
      this._startListening();
      return;
    }

    // I make ensure to call these operation only once conservatively because:
    //  * If we do these operations in a constructor of this class, Gecko throws `NotSupportedError: Operation is not supported`.
    //    * I'm not familiar with details of the spec, but this is not Gecko's bug.
    //      See https://dom.spec.whatwg.org/#concept-create-element
    //      "6. If result has children, then throw a "NotSupportedError" DOMException."
    //  * `connectedCallback()` may be called multiple times by append/remove operations.
    //
    // FIXME:
    //  Ideally, these descendants should be in shadow tree. Thus I don't change these element to custom elements.
    //  However, I hesitate to do it at this moment by these reasons.
    //  If we move these to shadow tree,
    //    * We need some rewrite our style.
    //      * This includes that we need to move almost CSS code into this file as a string.
    //    * I'm not sure about that whether we should require [CSS Shadow Parts](https://bugzilla.mozilla.org/show_bug.cgi?id=1559074).
    //      * I suspect we can resolve almost problems by using CSS Custom Properties.

    // We preserve this class for backward compatibility with other addons.
    this.classList.add(kTAB_CLASS_NAME);

    const label = document.createElement(kTAB_LABEL_ELEMENT_NAME);
    this.appendChild(label);
    label.addOverflowChangeListener(() => {
      if (this.$TST.tab.pinned)
        return;
      this.invalidateTooltip();
    });

    const twisty = document.createElement(kTAB_TWISTY_ELEMENT_NAME);
    this.insertBefore(twisty, label);
    twisty.owner = this;

    const favicon = document.createElement(kTAB_FAVICON_ELEMENT_NAME);
    this.insertBefore(favicon, label);

    const counter = document.createElement(kTAB_COUNTER_ELEMENT_NAME);
    this.appendChild(counter);
    counter.owner = this;

    const soundButton = document.createElement(kTAB_SOUND_BUTTON_ELEMENT_NAME);
    this.appendChild(soundButton);
    soundButton.owner = this;

    const closebox = document.createElement(kTAB_CLOSE_BOX_ELEMENT_NAME);
    this.appendChild(closebox);
    closebox.owner = this;

    const burster = document.createElement('span');
    burster.classList.add(Constants.kBURSTER);
    this.appendChild(burster);

    const activeMarker = document.createElement('span');
    activeMarker.classList.add(Constants.kHIGHLIGHTER);
    this.appendChild(activeMarker);

    const identityMarker = document.createElement('span');
    identityMarker.classList.add(Constants.kCONTEXTUAL_IDENTITY_MARKER);
    this.appendChild(identityMarker);

    const extraItemsContainerBehind = document.createElement('span');
    extraItemsContainerBehind.classList.add(Constants.kEXTRA_ITEMS_CONTAINER);
    extraItemsContainerBehind.classList.add('behind');
    this.appendChild(extraItemsContainerBehind);

    this.setAttribute('draggable', true);

    this.invalidate(TabInvalidationTarget.All);
    this._applyAttributes();
    this._startListening();
  }

  disconnectedCallback() {
    this._endListening();
  }

  get initialized() {
    return !!this._labelElement;
  }

  get _twistyElement() {
    return this.querySelector(kTAB_TWISTY_ELEMENT_NAME);
  }

  get _favIconElement() {
    return this.querySelector(kTAB_FAVICON_ELEMENT_NAME);
  }

  get _labelElement() {
    return this.querySelector(kTAB_LABEL_ELEMENT_NAME);
  }

  get _soundButtonElement() {
    return this.querySelector(kTAB_SOUND_BUTTON_ELEMENT_NAME);
  }

  get _counterElement() {
    return this.querySelector(kTAB_COUNTER_ELEMENT_NAME);
  }

  get closeBoxElement() {
    return this.querySelector(kTAB_CLOSE_BOX_ELEMENT_NAME);
  }

  set title(value) {
    const label = this._labelElement;
    if (label)
      label.value = value;

    this.dataset.title = value;
  }

  _applyAttributes() {
    this._labelElement.value = this.dataset.title;
    this.favIconUrl = this._favIconUrl;
  }

  invalidate(targets) {
    if (!this.initialized)
      return;

    if (targets & TabInvalidationTarget.Twisty) {
      const twisty = this._twistyElement;
      if (twisty)
        twisty.invalidate();
    }

    if (targets & TabInvalidationTarget.SoundButton) {
      const soundButton = this._soundButtonElement;
      if (soundButton)
        soundButton.invalidate();
    }

    if (targets & TabInvalidationTarget.CloseBox) {
      const closeBox = this.closeBoxElement;
      if (closeBox)
        closeBox.invalidate();
    }

    if (targets & TabInvalidationTarget.Tooltip)
      this.invalidateTooltip();

    if (targets & TabInvalidationTarget.Overflow)
      this._needToUpdateOverflow = true;
  }

  invalidateTooltip() {
    if (this._reservedUpdateTooltip)
      return;

    this._reservedUpdateTooltip = () => {
      delete this._reservedUpdateTooltip;
      this._updateTooltip();
    };
    this.addEventListener('mouseover', this._reservedUpdateTooltip, { once: true });
  }

  update(targets) {
    if (!this.initialized)
      return;

    if (targets & TabUpdateTarget.Counter) {
      const counter = this._counterElement;
      if (counter)
        counter.update();
    }

    if (targets & TabUpdateTarget.Overflow)
      this._updateOverflow();
  }

  updateOverflow() {
    if (this._needToUpdateOverflow || configs.labelOverflowStyle == 'fade')
      this._updateOverflow();
    this.invalidateTooltip();
  }

  _updateOverflow() {
    this._needToUpdateOverflow = false;
    const label = this._labelElement;
    if (label)
      label.updateOverflow();
  }

  _updateTooltip() {
    const tab = this.$TST.tab;
    if (!TabsStore.ensureLivingTab(tab))
      return;

    if (configs.debug) {
      this.tooltip = `
${tab.title}
#${tab.id}
(${this.$TST.element.className})
uniqueId = <${this.$TST.uniqueId.id}>
duplicated = <${!!this.$TST.uniqueId.duplicated}> / <${this.$TST.uniqueId.originalTabId}> / <${this.$TST.uniqueId.originalId}>
restored = <${!!this.$TST.uniqueId.restored}>
tabId = ${tab.id}
windowId = ${tab.windowId}
`.trim();
      this.$TST.setAttribute('title', this.tooltip);
      return;
    }

    this.tooltip = tab.title;
    this.tooltipWithDescendants = this._getTooltipWithDescendants(tab);

    if (configs.showCollapsedDescendantsByTooltip &&
        this.$TST.subtreeCollapsed &&
        this.$TST.hasChild) {
      this.$TST.setAttribute('title', this.tooltipWithDescendants);
    }
    else if (tab.pinned || this.overflow) {
      this.$TST.setAttribute('title', this.tooltip);
    }
    else {
      this.$TST.removeAttribute('title');
    }
  }
  _getTooltipWithDescendants(tab) {
    const tooltip = [`* ${tab.$TST.element.tooltip || tab.title}`];
    for (const child of tab.$TST.children) {
      if (!child.$TST.element.tooltipWithDescendants)
        child.$TST.element.tooltipWithDescendants = this._getTooltipWithDescendants(child);
      tooltip.push(child.$TST.element.tooltipWithDescendants.replace(/^/gm, '  '));
    }
    return tooltip.join('\n');
  }

  _startListening() {
    if (this.__onMouseOver)
      return;
    this.addEventListener('mouseover', this.__onMouseOver = this._onMouseOver.bind(this));
    window.addEventListener('resize', this.__onWindowResize = this._onWindowResize.bind(this));
    configs.$addObserver(this.__onConfigChange = this._onConfigChange.bind(this));
  }

  _endListening() {
    if (!this.__onMouseOver)
      return;
    this.removeEventListener('mouseover', this.__onMouseOver);
    delete this.__onMouseOver;
    window.removeEventListener('resize', this.__onWindowResize);
    delete this.__onWindowResize;
    configs.$removeObserver(this.__onConfigChange);
    delete this.__onConfigChange;
  }

  _onMouseOver(_event) {
    this._updateTabAndAncestorsTooltip(this.$TST.tab);
  }

  _onWindowResize(_event) {
    this.invalidateTooltip();
  }

  _onConfigChange(changedKey) {
    switch (changedKey) {
      case 'showCollapsedDescendantsByTooltip':
        this.invalidateTooltip();
        break;

      case 'labelOverflowStyle':
        this.updateOverflow();
        break;
    }
  }

  _updateTabAndAncestorsTooltip(tab) {
    if (!TabsStore.ensureLivingTab(tab))
      return;
    for (const updateTab of [tab].concat(tab.$TST.ancestors)) {
      updateTab.$TST.element.invalidateTooltip();
      // on the "fade" mode, overflow style was already updated,
      // so we don' need to update the status here.
      if (configs.labelOverflowStyle != 'fade')
        updateTab.$TST.element.updateOverflow();
    }
  }

  get favIconUrl() {
    if (!this.initialized)
      return null;

    return this._favIconElement.src;
  }

  set favIconUrl(url) {
    this._favIconUrl = url;
    if (!this.initialized || !this.$TST)
      return url;

    TabFavIconHelper.loadToImage({
      image: this._favIconElement,
      tab: this.$TST.tab,
      url
    });
  }

  get overflow() {
    const label = this._labelElement;
    return label && label.overflow;
  }

  set label(value) {
    const label = this._labelElement;
    if (label)
      label.value = value;

    this.dataset.title = value; // for custom CSS https://github.com/piroor/treestyletab/issues/2242
    this.invalidateTooltip();
    if (this.$TST.collapsed)
      this._needToUpdateOverflow = true;
  }
}
