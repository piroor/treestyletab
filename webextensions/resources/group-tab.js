/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

(() => {
  if (window.initialized)
    return false;

  let gTitle;
  let gTitleField;
  let gTemporaryCheck;

  document.title = getTitle();

  function getTitle() {
    const params = location.search.split('#')[0];
    let title = params.match(/[&?]title=([^&;]*)/);
    if (!title)
      title = params.match(/^\?([^&;]*)/);
    return title && decodeURIComponent(title[1]) ||
             browser.i18n.getMessage('groupTab_label_default');
  }

  function setTitle(title) {
    if (!gTitle)
      init();
    document.title = gTitle.textContent = gTitleField.value = title;
    updateParameters({ title });
  }

  function isTemporary() {
    const params = location.search.split('#')[0];
    return /[&?]temporary=true/.test(params);
  }

  function getOpenerTabId() {
    const params = location.search.split('#')[0];
    const matched = params.match(/[&?]openerTabId=([^&;]*)/);
    return matched && matched[1];
  }

  function enterTitleEdit() {
    if (!gTitle)
      init();
    gTitle.style.display = 'none';
    gTitleField.style.display = 'inline';
    gTitleField.select();
    gTitleField.focus();
  }

  function exitTitleEdit() {
    if (!gTitle)
      init();
    gTitle.style.display = '';
    gTitleField.style.display = '';
  }

  function hasModifier(event) {
    return event.altKey ||
           event.ctrlKey ||
           event.metaKey ||
           event.shiftKey;
  }

  function updateParameters(aParameters = {}) {
    const title     = aParameters.title || getTitle() || '';
    const temporary = String(gTemporaryCheck.checked);

    let opener = getOpenerTabId();
    opener = opener ? `&openerTabId=${opener}` : '';

    let uri = location.href.split('?')[0];
    uri = `${uri}?title=${encodeURIComponent(title)}&temporary=${temporary}${opener}`;
    history.replaceState({}, document.title, uri);
  }

  function init() {
    if (gTitle)
      return;
    gTitle = document.querySelector('#title');
    gTitleField = document.querySelector('#title-field');

    gTitle.addEventListener('click', event => {
      if (event.button == 0 &&
          !hasModifier(event)) {
        enterTitleEdit();
        event.stopPropagation();
      }
    });
    gTitleField.addEventListener('keyup', event => {
      if (hasModifier(event))
        return;

      switch (event.key) {
        case 'Escape':
          gTitleField.value = gTitle.textContent;
          exitTitleEdit();
          break;

        case 'Enter':
          setTitle(gTitleField.value);
          exitTitleEdit();
          break;

        case 'F2':
          event.stopPropagation();
          break;
      }
    });
    window.addEventListener('click', event => {
      const link = event.target.closest('a');
      if (link) {
        browser.runtime.sendMessage({
          type: 'treestyletab:api:focus',
          tab:  parseInt(link.dataset.tabId)
        });
        return;
      }
      if (event.button != 0 ||
          hasModifier(event))
        return;
      if (event.target != gTitleField) {
        setTitle(gTitleField.value);
        exitTitleEdit();
        event.stopPropagation();
      }
    });
    window.addEventListener('keyup', event => {
      if (event.key == 'F2' &&
          !hasModifier(event))
        enterTitleEdit();
    });

    window.addEventListener('resize', reflow);

    gTitle.textContent = gTitleField.value = getTitle();

    gTemporaryCheck = document.querySelector('#temporary');
    gTemporaryCheck.checked = isTemporary();
    gTemporaryCheck.addEventListener('change', _event => updateParameters());

    window.l10n.updateDocument();

    updateTree();

    window.setTitle    = window.setTitle || setTitle;
    window.updateTree  = window.updateTree || updateTree;
    window.initialized = true;
  }
  //document.addEventListener('DOMContentLoaded', init, { once: true });


  async function updateTree() {
    const tabs = await browser.runtime.sendMessage({
      type: 'treestyletab:api:get-tree',
      tabs: [
        'senderTab',
        getOpenerTabId()
      ]
    });
    const container = document.getElementById('tabs');
    const range = document.createRange();
    range.selectNodeContents(container);
    range.deleteContents();
    range.detach();
    let tree;
    if (tabs[1]) {
      tabs[1].children = tabs[0].children;
      tree = buildChildren({ children: [tabs[1]] });
    }
    else
      tree = buildChildren(tabs[0]);
    if (tree) {
      container.appendChild(tree);
      reflow();
    }
  }

  function reflow() {
    const container = document.getElementById('tabs');
    columnizeTree(container.firstChild, {
      columnWidth: '20em',
      containerRect: container.getBoundingClientRect()
    });
  }

  function buildItem(tab) {
    const item = document.createElement('li');

    const link = item.appendChild(document.createElement('a'));
    link.href = '#';
    link.setAttribute('title', tab.title);
    link.dataset.tabId = tab.id;

    const icon = link.appendChild(document.createElement('img'));
    if (tab.effectiveFavIconUrl || tab.favIconUrl) {
      icon.src = tab.effectiveFavIconUrl || tab.favIconUrl;
      icon.onerror = () => {
        item.classList.remove('favicon-loading');
        item.classList.add('use-default-favicon');
      };
      icon.onload = () => {
        item.classList.remove('favicon-loading');
      };
      item.classList.add('favicon-loading');
    }
    else {
      item.classList.add('use-default-favicon');
    }

    const label = link.appendChild(document.createElement('span'));
    label.classList.add('label');
    label.textContent = tab.title;

    const children = buildChildren(tab);
    if (!children)
      return item;

    const fragment = document.createDocumentFragment();
    fragment.appendChild(item);
    const childrenWrapped = document.createElement('li');
    childrenWrapped.appendChild(children);
    fragment.appendChild(childrenWrapped);
    return fragment;
  }

  function buildChildren(tab) {
    if (tab.children && tab.children.length > 0) {
      const list = document.createElement('ul');
      for (const child of tab.children) {
        list.appendChild(buildItem(child));
      }
      return list;
    }
    return null;
  }

  function columnizeTree(aTree, options) {
    options = options || {};
    options.columnWidth = options.columnWidth || '20em';

    const style = aTree.style;
    style.columnWidth = style.MozColumnWidth = `calc(${options.columnWidth})`;
    const computedStyle = window.getComputedStyle(aTree, null);
    aTree.columnWidth = Number((computedStyle.MozColumnWidth || computedStyle.columnWidth).replace(/px/, ''));
    style.columnGap   = style.MozColumnGap = '1em';
    style.columnFill  = style.MozColumnFill = 'auto';
    style.columnCount = style.MozColumnCount = 'auto';

    const containerRect = options.containerRect || aTree.parentNode.getBoundingClientRect();
    const maxWidth = containerRect.width;
    if (aTree.columnWidth * 2 <= maxWidth ||
        options.calculateCount) {
      style.height = style.maxHeight =
        Math.floor(containerRect.height * 0.9) + 'px';

      if (getActualColumnCount(aTree) <= 1)
        style.columnWidth = style.MozColumnWidth = '';
    }
    else {
      style.height = style.maxHeight = '';
    }
  }

  function getActualColumnCount(aTree) {
    const range = document.createRange();
    range.selectNodeContents(aTree);
    const rect = range.getBoundingClientRect();
    range.detach();
    return Math.floor(rect.width / aTree.columnWidth);
  }

  init();
  return true;
})();
