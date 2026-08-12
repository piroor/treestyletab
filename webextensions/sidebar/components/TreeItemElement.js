/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

import * as Constants from '/common/constants.js';
import { TreeItem } from '/common/TreeItem.js';

import {
  kTREE_ITEM_SUBSTANCE_ELEMENT_NAME,
  TabInvalidationTarget as ImportedTabInvalidationTarget,
  TabUpdateTarget as ImportedTabUpdateTarget,
} from './TreeItemSubstanceElement.js';

export const kTREE_ITEM_ELEMENT_NAME = 'tab-item';

// for backward compatibility
export const TabInvalidationTarget = ImportedTabInvalidationTarget;
export const TabUpdateTarget = ImportedTabUpdateTarget;

const kTAB_CLASS_NAME = 'tab';

const NATIVE_PROPERTIES = new Set([
  'active',
  'attention',
  'audible',
  'discarded',
  'hidden',
  'highlighted',
  'pinned'
]);
const IGNORE_CLASSES = new Set([
  'tab',
  'split-view-main',
  'split-view-sub',
  'split-substances-container',
  Constants.kTAB_STATE_ANIMATION_READY,
  Constants.kTAB_STATE_HAS_ACTIVE_SUBSTANCE,
  Constants.kTAB_STATE_SPLIT_VIEW,
  Constants.kTAB_STATE_SUBTREE_COLLAPSED
]);

export class TreeItemElement extends HTMLElement {
  static define() {
    window.customElements.define(kTREE_ITEM_ELEMENT_NAME, TreeItemElement);
  }

  constructor() {
    super();

    // We should initialize private properties with blank value for better performance with a fixed shape.
    this._extraItemsContainerIndentRoot = null;
    this._IGNORE_CLASSES_MATCHER = null;
  }

  static get observedAttributes() {
    return [
      'type',
      'class',
      Constants.kAPI_NATIVE_TAB_GROUP_ID,
      Constants.kAPI_TAB_ID,
      Constants.kAPI_WINDOW_ID,
      Constants.kGROUP_ID,
      Constants.kSPLIT_VIEW_ID,
      Constants.kPARENT,
      Constants.kCHILDREN,
      Constants.kCURRENT_URI,
      Constants.kCURRENT_FAVICON_URI,
      Constants.kCONTEXTUAL_IDENTITY_NAME,
      Constants.kDROP_POSITION,
      Constants.kNEXT_GROUP_COLOR,
    ];
  }

  get IGNORE_CLASSES_MATCHER() {
    return this._IGNORE_CLASSES_MATCHER ||= new RegExp(`(^|\s)(tab|${Constants.kTAB_STATE_HAS_ACTIVE_SUBSTANCE}|${Constants.kTAB_STATE_SPLIT_VIEW})($|\s)`, 'g');
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue ||
        !this.substanceElement)
      return;

    // we must not inherit the "tab" class because it is used for backward compatibility of tab-item
    if (name == 'class' &&
        typeof newValue == 'string') {
      newValue = newValue.replace(this.IGNORE_CLASSES_MATCHER, ' ') + ' split-view-main';
    }

    if (newValue !== null) {
      this.substanceElement?.setAttribute(name, newValue);
    }
    else {
      this.substanceElement?.removeAttribute(name);
    }
  }

  connectedCallback() {
    this.setAttribute('role', 'option');

    if (this.initialized) {
      this.initializeContents();
      this.invalidate(TabInvalidationTarget.All);
      this.update(TabUpdateTarget.TabProperties);
      this.applyAttributes();
      return;
    }

    // I ensure to call these operations only once conservatively because:
    //  * If we do these operations in a constructor of this class, Gecko throws `NotSupportedError: Operation is not supported`.
    //    * I'm not familiar with details of the spec, but this is not Gecko's bug.
    //      See https://dom.spec.whatwg.org/#concept-create-element
    //      "6. If result has children, then throw a "NotSupportedError" DOMException."
    //  * `connectedCallback()` may be called multiple times by append/remove operations.
    //
    // FIXME:
    //  Ideally, these descendants should be in a shadow tree. Thus I don't change these elements to custom elements.
    //  However, I hesitate to do it at this moment for these reasons.
    //  If we move these to shadow tree,
    //    * We need to rewrite some of our styles.
    //      * This means we would need to move almost all CSS code into this file as a string.
    //    * I'm not sure whether we should require [CSS Shadow Parts](https://bugzilla.mozilla.org/show_bug.cgi?id=1559074).
    //      * I suspect we can resolve almost all problems by using CSS Custom Properties.

    // We preserve this class for backward compatibility with other addons.
    this.classList.add(kTAB_CLASS_NAME);

    /* The DOM structure will be fulfilled as following with delayed creations of elements:

      <span class="native-tab-group-line"></span>
      <span class="${Constants.kEXTRA_ITEMS_CONTAINER} indent"></span>
      <${kTREE_ITEM_SUBSTANCE_ELEMENT_NAME} draggable="true"></${kTREE_ITEM_SUBSTANCE_ELEMENT_NAME}>
    */

    this.insertAdjacentHTML('beforeend', `<${kTREE_ITEM_SUBSTANCE_ELEMENT_NAME} class="split-view-main" draggable="true"></${kTREE_ITEM_SUBSTANCE_ELEMENT_NAME}>`);

    for (const name of TreeItemElement.observedAttributes) {
      if (!this.hasAttribute(name))
        continue;

      // we must not inherit the "tab" class because it is used for backward compatibility of tab-item
      let value = this.getAttribute(name);
      if (name == 'class') {
        value = value.replace(this.IGNORE_CLASSES_MATCHER, ' ') + ' split-view-main';
      }
      this.substanceElement?.setAttribute(name, value);
    }

    this.removeAttribute('draggable');

    this.initializeContents();
    this.invalidate(TabInvalidationTarget.All);
    this.update(TabUpdateTarget.TabProperties);
    this.applyAttributes();
  }

  disconnectedCallback() {
    this.substanceElement?.cancelTooltipUpdate();
    this._extraItemsContainerIndentRoot = null;
  }

  get initialized() {
    return !!this.substanceElement;
  }

  initializeContents() {
    this.substanceElement?.initializeContents();
  }

  get type() {
    return this.getAttribute('type');
  }

  // Elements restored from cache are initialized without bundled tabs.
  // Thus we provide ability to get tab and service objects from cached/restored information.
  get raw() {
    return this.substanceElement?.raw;
  }
  set raw(value) {
    if (this.substanceElement)
      this.substanceElement.raw = value;
  }

  get tab() { // for backward compatibility
    return this.substanceElement?.tab;
  }
  set tab(value) {
    if (this.substanceElement)
      this.substanceElement.tab = value;
  }

  get $TST() {
    return this.substanceElement?.$TST;
  }
  set $TST(value) {
    if (this.substanceElement)
      this.substanceElement.$TST = value;
  }

  get itemElement() {
    return this;
  }

  get substanceElement() {
    // The "split-view-main" class may be missing while updagin, so fallback to the position-based selector.
    return this.querySelector(`${kTREE_ITEM_SUBSTANCE_ELEMENT_NAME}.split-view-main, ${kTREE_ITEM_SUBSTANCE_ELEMENT_NAME}:nth-of-type(1)`);
  }

  get subSplitViewSubstanceElement() {
    // The "split-view-sub" class may be missing while updagin, so fallback to the position-based selector.
    return this.querySelector(`${kTREE_ITEM_SUBSTANCE_ELEMENT_NAME}.split-view-sub, ${kTREE_ITEM_SUBSTANCE_ELEMENT_NAME}:nth-of-type(2)`);
  }

  get twisty() {
    return this.substanceElement?.twisty;
  }

  get favicon() {
    return this.substanceElement?.favicon;
  }

  get labelElement() {
    return this.substanceElement?.labelElement;
  }

  get soundButtonElement() {
    return this.substanceElement?.soundButtonElement;
  }

  get counterElement() {
    return this.substanceElement?.counterElement;
  }

  get closeBox() {
    return this.substanceElement?.closeBox;
  }

  applyAttributes() {
    this.setAttribute('aria-selected', this.classList.contains(Constants.kTAB_STATE_HIGHLIGHTED) ? 'true' : 'false');

    if (this.getAttribute('type') == TreeItem.TYPE_TAB && this.raw) {
      this.dataset.index = this.raw.index;
    }

    this.substanceElement?.applyAttributes();
  }

  invalidate(targets) {
    if (!this.initialized)
      return;

    this.substanceElement?.invalidate(targets);

    if (targets & TabInvalidationTarget.Tooltip)
      this.substanceElement?.invalidateTooltip();
  }

  invalidateTooltip() {
    this.substanceElement?.invalidateTooltip();
  }

  update(targets) {
    if (!this.initialized)
      return;

    this.substanceElement?.update(targets);

    if (targets & TabUpdateTarget.DescendantsHighlighted)
      this._updateDescendantsHighlighted();

    if (targets & TabUpdateTarget.CollapseExpandState)
      this._updateCollapseExpandState();

    if (targets & TabUpdateTarget.TabProperties)
      this.updateTabProperties();
  }

  updateTooltip() {
    this.substanceElement?.updateTooltip();
  }

  get useTooltipWithDescendants() {
    return this.substanceElement?.useTooltipWithDescendants;
  }

  get tooltip() {
    return this.substanceElement?.tooltip;
  }
  get tooltipWithDescendants() {
    return this.substanceElement?.tooltipWithDescendants;
  }
  get tooltipHtml() {
    return this.substanceElement?.tooltipHtml;
  }
  get tooltipHtmlWithDescendants() {
    return this.substanceElement?.tooltipHtmlWithDescendants;
  }
  get appliedTooltipText() {
    return this.substanceElement?.appliedTooltipText;
  }
  get appliedTooltipHtml() {
    return this.substanceElement?.appliedTooltipHtml;
  }
  get hasCustomTooltip() {
    return this.substanceElement?.hasCustomTooltip;
  }
  get tooltipText() {
    return this.substanceElement?.tooltipText;
  }


  updateOverflow() {
    this.substanceElement?.updateOverflow();
  }

  get safeExtraItemsContainerIndentRoot() {
    if (this._extraItemsContainerIndentRoot)
      return this._extraItemsContainerIndentRoot;

    let container = this.querySelector(`.${Constants.kEXTRA_ITEMS_CONTAINER}.indent`);
    if (!container) {
      container = document.createElement('span');
      container.className = `${Constants.kEXTRA_ITEMS_CONTAINER} indent`;
      this.insertBefore(container, this.substanceElement);
    }
    return this.unsafeExtraItemsContainerIndentRoot;
  }
  get unsafeExtraItemsContainerIndentRoot() {
    const container = this.querySelector(`.${Constants.kEXTRA_ITEMS_CONTAINER}.indent`);
    if (container && !this._extraItemsContainerIndentRoot) {
      this._extraItemsContainerIndentRoot = container.shadowRoot || container.attachShadow({ mode: 'open' });
      this._extraItemsContainerIndentRoot.itemById ||= new Map();
    }
    return this._extraItemsContainerIndentRoot;
  }

  get safeExtraItemsContainerBehindRoot() {
    return this.substanceElement?.safeExtraItemsContainerBehindRoot;
  }
  get unsafeExtraItemsContainerBehindRoot() {
    return this.substanceElement?.unsafeExtraItemsContainerBehindRoot;
  }

  get safeExtraItemsContainerFrontRoot() {
    return this.substanceElement?.safeExtraItemsContainerFrontRoot;
  }
  get unsafeExtraItemsContainerFrontRoot() {
    return this.substanceElement?.unsafeExtraItemsContainerFrontRoot;
  }

  get safeExtraItemsContainerAboveRoot() {
    return this.substanceElement?.safeExtraItemsContainerAboveRoot;
  }
  get unsafeExtraItemsContainerAboveRoot() {
    return this.substanceElement?.unsafeExtraItemsContainerAboveRoot;
  }

  get safeExtraItemsContainerBelowRoot() {
    return this.substanceElement?.safeExtraItemsContainerBelowRoot;
  }
  get unsafeExtraItemsContainerBelowRoot() {
    return this.substanceElement?.unsafeExtraItemsContainerBelowRoot;
  }

  ensureBurster() {
    this.substanceElement?.ensureBurster();
  }

  ensureContextualIdentityMarker() {
    this.substanceElement?.ensureContextualIdentityMarker();
  }

  ensureNativeTabGroupLine() {
    if (!this.querySelector('.native-tab-group-line')) {
      const line = document.createElement('span');
      line.className = 'native-tab-group-line';
      this.insertBefore(line, this.firstChild);
    }
  }

  ensureSplit() {
    if (this.subSplitViewSubstanceElement)
      return;

    this.insertAdjacentHTML('beforeend', `
      <span class="split-tab-separator"></span>
      <${kTREE_ITEM_SUBSTANCE_ELEMENT_NAME} class="split-view-sub" draggable="true"></${kTREE_ITEM_SUBSTANCE_ELEMENT_NAME}>
      <${kTREE_ITEM_SUBSTANCE_ELEMENT_NAME} class="split-substances-container"></${kTREE_ITEM_SUBSTANCE_ELEMENT_NAME}>
    `);
  }

  clearSplit() {
    this.subSplitViewSubstanceElement?.remove();
    for (const element of this.querySelectorAll(`.split-substances-container, .split-tab-separator`)) {
      element.remove();
    }
  }

  _updateDescendantsHighlighted() {
    if (!this.$TST) // called before binding on restoration from cache
      return;

    const children = this.$TST.children;
    if (!this.$TST.hasChild) {
      this.$TST.removeState(Constants.kTAB_STATE_SOME_DESCENDANTS_HIGHLIGHTED);
      this.$TST.removeState(Constants.kTAB_STATE_ALL_DESCENDANTS_HIGHLIGHTED);
      return;
    }
    let someHighlighted = false;
    let allHighlighted  = true;
    for (const child of children) {
      if (child.$TST.states.has(Constants.kTAB_STATE_HIGHLIGHTED)) {
        someHighlighted = true;
        allHighlighted = (
          allHighlighted &&
          (!child.$TST.hasChild ||
           child.$TST.states.has(Constants.kTAB_STATE_ALL_DESCENDANTS_HIGHLIGHTED))
        );
      }
      else {
        if (!someHighlighted &&
            child.$TST.states.has(Constants.kTAB_STATE_SOME_DESCENDANTS_HIGHLIGHTED)) {
          someHighlighted = true;
        }
        allHighlighted = false;
      }
    }
    if (someHighlighted) {
      this.$TST.addState(Constants.kTAB_STATE_SOME_DESCENDANTS_HIGHLIGHTED);
      this.$TST.toggleState(Constants.kTAB_STATE_ALL_DESCENDANTS_HIGHLIGHTED, allHighlighted);
    }
    else {
      this.$TST.removeState(Constants.kTAB_STATE_SOME_DESCENDANTS_HIGHLIGHTED);
      this.$TST.removeState(Constants.kTAB_STATE_ALL_DESCENDANTS_HIGHLIGHTED);
    }
  }

  _updateCollapseExpandState() {
    if (!this.$TST) // called before binding on restoration from cache
      return;

    const classList = this.classList;
    const parent = this.$TST.parent;
    if (this.$TST.collapsed ||
        (parent &&
         (parent.$TST.collapsed ||
          parent.$TST.subtreeCollapsed))) {
      if (!classList.contains(Constants.kTAB_STATE_COLLAPSED))
        classList.add(Constants.kTAB_STATE_COLLAPSED);
      if (!classList.contains(Constants.kTAB_STATE_COLLAPSED_DONE))
        classList.add(Constants.kTAB_STATE_COLLAPSED_DONE);
    }
    else {
      if (classList.contains(Constants.kTAB_STATE_COLLAPSED))
        classList.remove(Constants.kTAB_STATE_COLLAPSED);
      if (classList.contains(Constants.kTAB_STATE_COLLAPSED_DONE))
        classList.remove(Constants.kTAB_STATE_COLLAPSED_DONE);
    }
  }

  updateTabProperties() {
    if (!this.$TST) // called before binding on restoration from cache
      return;

    this.substanceElement?.updateTabProperties();

    const raw       = this.$TST.raw;
    const classList = this.classList;

    const tab = this.$TST.tab;
    if (tab) {
      for (const state of classList) {
        if (IGNORE_CLASSES.has(state) ||
            NATIVE_PROPERTIES.has(state))
          continue;
        if (!this.$TST.states.has(state))
          classList.remove(state);
      }
      for (const state of this.$TST.states) {
        if (IGNORE_CLASSES.has(state))
          continue;
        if (!classList.contains(state))
          classList.add(state);
      }

      for (const state of NATIVE_PROPERTIES) {
        if (raw[state] == classList.contains(state))
          continue;
        classList.toggle(state, raw[state]);
      }

      if (this.$TST.childIds.length > 0)
        this.setAttribute(Constants.kCHILDREN, `|${this.$TST.childIds.join('|')}|`);
      else
        this.removeAttribute(Constants.kCHILDREN);

      if (this.$TST.parentId)
        this.setAttribute(Constants.kPARENT, this.$TST.parentId);
      else
        this.removeAttribute(Constants.kPARENT);

      const alreadyGrouped = this.$TST.getAttribute(Constants.kPERSISTENT_ALREADY_GROUPED_FOR_PINNED_OPENER) || '';
      if (this.getAttribute(Constants.kPERSISTENT_ALREADY_GROUPED_FOR_PINNED_OPENER) != alreadyGrouped)
        this.setAttribute(Constants.kPERSISTENT_ALREADY_GROUPED_FOR_PINNED_OPENER, alreadyGrouped);

      const opener = this.$TST.getAttribute(Constants.kPERSISTENT_ORIGINAL_OPENER_TAB_ID) || '';
      if (this.getAttribute(Constants.kPERSISTENT_ORIGINAL_OPENER_TAB_ID) != opener)
        this.setAttribute(Constants.kPERSISTENT_ORIGINAL_OPENER_TAB_ID, opener);

      const uri = this.$TST.getAttribute(Constants.kCURRENT_URI) || tab?.url;
      if (this.getAttribute(Constants.kCURRENT_URI) != uri)
        this.setAttribute(Constants.kCURRENT_URI, uri);

      const favIconUri = this.$TST.getAttribute(Constants.kCURRENT_FAVICON_URI) || tab?.favIconUrl;
      if (this.getAttribute(Constants.kCURRENT_FAVICON_URI) != favIconUri)
        this.setAttribute(Constants.kCURRENT_FAVICON_URI, favIconUri);

      const level = this.$TST.getAttribute(Constants.kLEVEL) || 0;
      if (this.getAttribute(Constants.kLEVEL) != level)
        this.setAttribute(Constants.kLEVEL, level);

      const id = this.$TST.uniqueId.id;
      if (this.getAttribute(Constants.kPERSISTENT_ID) != id)
        this.setAttribute(Constants.kPERSISTENT_ID, id);

      if (this.$TST.subtreeCollapsed) {
        if (!classList.contains(Constants.kTAB_STATE_SUBTREE_COLLAPSED))
          classList.add(Constants.kTAB_STATE_SUBTREE_COLLAPSED);
      }
      else {
        if (classList.contains(Constants.kTAB_STATE_SUBTREE_COLLAPSED))
          classList.remove(Constants.kTAB_STATE_SUBTREE_COLLAPSED);
      }
    }

    const group = this.$TST.nativeTabGroup || this.$TST.group;
    if (group) {
      this.ensureNativeTabGroupLine();
      this.style.setProperty('--tab-group-color', `var(--tab-group-color-${group.color})`);
      this.style.setProperty('--tab-group-color-pale', `var(--tab-group-color-${group.color}-pale)`);
      this.style.setProperty('--tab-group-color-invert', `var(--tab-group-color-${group.color}-invert)`);
      this.style.setProperty('--tab-group-color-text', `var(--tab-group-color-${group.color}-text)`); // Nova specific
      this.style.setProperty('--tab-group-color-hover', `var(--tab-group-color-${group.color}-hover)`); // Nova specific
    }
    if (this.$TST.group) {
      classList.toggle(Constants.kTAB_STATE_SUBTREE_COLLAPSED, group.collapsed);
    }
  }

  get favIconUrl() {
    return this.substanceElement?.favIconUrl;
  }

  set favIconUrl(url) {
    if (this.substanceElement)
      this.substanceElement.favIconUrl = url;
  }

  get overflow() {
    return this.labelElement?.overflow;
  }

  get label() {
    return this.substanceElement?.label;
  }
  set label(value) {
    this.dataset.title = value; // for custom CSS https://github.com/piroor/treestyletab/issues/2242

    if (this.substanceElement)
      this.substanceElement.label = value;

    if (!this.$TST) // called before binding on restoration from cache
      return;

    this.substanceElement?.invalidateTooltip();
  }

  cleanup() {
    this._extraItemsContainerIndentRoot?.host.remove();
    this._extraItemsContainerIndentRoot = null;

    this.querySelector(`.native-tab-group-line`)?.remove();
    this.substanceElement?.cleanup();

    this.clearSplit();
  }
}
