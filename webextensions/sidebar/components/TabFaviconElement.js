export const kTAB_FAVICON_ELEMENT_NAME = 'tab-favicon';

export class TabFaviconElement extends HTMLElement {
  static define() {
    window.customElements.define(kTAB_FAVICON_ELEMENT_NAME, TabFaviconElement);
  }
}