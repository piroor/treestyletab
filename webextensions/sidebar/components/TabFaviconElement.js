import * as Constants from '/common/constants.js';

export const kTAB_FAVICON_ELEMENT_NAME = 'tab-favicon';

export class TabFaviconElement extends HTMLElement {
  static define() {
    window.customElements.define(kTAB_FAVICON_ELEMENT_NAME, TabFaviconElement);
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
    //
    // FIXME:
    //  Ideally, these descendants should be in shadow tree. Thus I don't change these element to custom elements.
    //  However, I hesitate to do it at this moment by these reasons.
    //  If we move these to shadow tree,
    //    * We need some rewrite our style.
    //      * This includes that we need to move almost CSS code into this file as a string.
    //    * I'm not sure about that whether we should require [CSS Shadow Parts](https://bugzilla.mozilla.org/show_bug.cgi?id=1559074).
    //      * I suspect we can resolve almost problems by using CSS Custom Properties.
    const faviconImage = this.appendChild(document.createElement('img'));
    faviconImage.classList.add(Constants.kFAVICON_IMAGE);
    const defaultIcon = this.appendChild(document.createElement('span'));
    defaultIcon.classList.add(Constants.kFAVICON_BUILTIN);
    defaultIcon.classList.add(Constants.kFAVICON_DEFAULT); // just for backward compatibility, and this should be removed from future versions

    const throbber = this.appendChild(document.createElement('span'));
    throbber.classList.add(Constants.kTHROBBER);

    this._isInitialized = true;
  }

  getImageElement() {
    return this.firstElementChild;
  }
}