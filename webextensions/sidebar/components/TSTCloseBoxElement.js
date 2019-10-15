const NORMAL_TOOLTIP = 'tab_closebox_tab_tooltip';
const MULTISELECTED_TOOLTIP = 'tab_closebox_tab_tooltip_multiselected';
const TREE_TOOLTIP = 'tab_closebox_tree_tooltip';

export const CloseBoxTooltipType = Object.freeze({
  Normal: 'normal',
  MultiSelected: 'multiselected',
  Tree: 'tree',
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