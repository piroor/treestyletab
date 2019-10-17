/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

const NORMAL_TOOLTIP        = 'tab_closebox_tab_tooltip';
const MULTISELECTED_TOOLTIP = 'tab_closebox_tab_tooltip_multiselected';
const TREE_TOOLTIP          = 'tab_closebox_tree_tooltip';

export const CloseBoxTooltipType = Object.freeze({
  Normal:        'normal',
  MultiSelected: 'multiselected',
  Tree:          'tree',
});

function getTooltipLabelKey(tooltipType) {
  switch (tooltipType) {
    case CloseBoxTooltipType.Normal:
      return NORMAL_TOOLTIP;
    case CloseBoxTooltipType.MultiSelected:
      return MULTISELECTED_TOOLTIP;
    case CloseBoxTooltipType.Tree:
      return TREE_TOOLTIP;
    default:
      throw new RangeError(`${tooltipType} is not unknown TooltipType`);
  }
}

export const kTAB_CLOSE_BOX_ELEMENT_NAME = 'tab-closebox';

const kTAB_CLOSE_BOX_CLASS_NAME = 'closebox';

export class TabCloseBoxElement extends HTMLElement {
  static define() {
    window.customElements.define(kTAB_CLOSE_BOX_ELEMENT_NAME, TabCloseBoxElement);
  }

  constructor() {
    super();

    this._isInitialized = false;
  }

  connectedCallback() {
    if (this._isInitialized) {
      return;
    }

    // I make ensure to call these operation only once conservatively because:
    //  * If we do these operations in a constructor of this class, Gecko throws `NotSupportedError: Operation is not supported`.
    //    * I'm not familiar with details of the spec, but this is not Gecko's bug.
    //      See https://dom.spec.whatwg.org/#concept-create-element
    //      "6. If result has children, then throw a "NotSupportedError" DOMException."
    //  * `connectedCallback()` may be called multiple times by append/remove operations.
    //  * `browser.i18n.getMessage()` might be a costly operation.

    // We preserve this class for backward compatibility with other addons.
    this.classList.add(kTAB_CLOSE_BOX_CLASS_NAME);

    this.setAttribute('title', browser.i18n.getMessage(NORMAL_TOOLTIP));
    this.setAttribute('draggable', true); // this is required to cancel click by dragging

    this._isInitialized = true;
  }

  updateTooltip(tooltipType) {
    const key = getTooltipLabelKey(tooltipType);
    const tooltip = browser.i18n.getMessage(key);
    this.setAttribute('title', tooltip);
  }
}