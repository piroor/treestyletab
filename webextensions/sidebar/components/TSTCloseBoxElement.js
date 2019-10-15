import * as Constants from '/common/constants.js';

export class TSTCloseBoxElement extends HTMLElement {
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
    this.classList.add(Constants.kCLOSEBOX);
    this.setAttribute('title', browser.i18n.getMessage('tab_closebox_tab_tooltip'));
    this.setAttribute('draggable', true); // this is required to cancel click by dragging

    this._isInitialized = true;
  }
}