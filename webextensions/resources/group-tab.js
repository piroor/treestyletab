/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

var gTemporaryCheck;
var gTitle;
var gTitleField;

document.title = getTitle();

function getTitle() {
  const params = location.search.split('#')[0];
  let title = params.match(/[&?]title=([^&;]*)/);
  if (!title)
    title = params.match(/^\?([^&;]*)/);
  return title && decodeURIComponent(title[1]) ||
           browser.i18n.getMessage('groupTab_label_default');
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
  gTitle.style.display = 'none';
  gTitleField.style.display = 'inline';
  gTitleField.select();
  gTitleField.focus();
}

function exitTitleEdit() {
  gTitle.style.display = '';
  gTitleField.style.display = '';
}

function hasModifier(aEvent) {
  return aEvent.altKey ||
         aEvent.ctrlKey ||
         aEvent.metaKey ||
         aEvent.shiftKey;
}

function updateParameters(aParameters = {}) {
  var title     = aParameters.title || getTitle() || '';
  var temporary = String(gTemporaryCheck.checked);

  var opener    = getOpenerTabId();
  opener = opener ? `&openerTabId=${opener}` : '';

  var uri = location.href.split('?')[0];
  uri = `${uri}?title=${encodeURIComponent(title)}&temporary=${temporary}${opener}`;
  location.replace(uri);
}

function init() {
  gTitle = document.querySelector('#title');
  gTitleField = document.querySelector('#title-field');

  gTitle.addEventListener('click', aEvent => {
    if (aEvent.button == 0 &&
        !hasModifier(aEvent)) {
      enterTitleEdit();
      aEvent.stopPropagation();
    }
  });
  gTitleField.addEventListener('keypress', aEvent => {
    if (hasModifier(aEvent))
      return;

    switch (aEvent.keyCode) {
      case KeyEvent.DOM_VK_ESCAPE:
        gTitleField.value = gTitle.textContent;
        exitTitleEdit();
        break;

      case KeyEvent.DOM_VK_ENTER:
      case KeyEvent.DOM_VK_RETURN:
        updateParameters({ title: gTitleField.value });
        break;

      case KeyEvent.DOM_VK_F2:
        aEvent.stopPropagation();
        break;
    }
  });
  window.addEventListener('click', aEvent => {
    const link = aEvent.target.closest('a');
    if (link) {
      browser.runtime.sendMessage({
        type: 'treestyletab:api:focus',
        tab:  parseInt(link.dataset.tabId)
      });
      return;
    }
    if (aEvent.button == 0 &&
        !hasModifier(aEvent) &&
        aEvent.target != gTitleField) {
      gTitleField.value = gTitle.textContent;
      exitTitleEdit();
      aEvent.stopPropagation();
    }
  });
  window.addEventListener('keypress', aEvent => {
    if (aEvent.keyCode == KeyEvent.DOM_VK_F2 &&
        !hasModifier(aEvent))
      enterTitleEdit();
  });

  window.addEventListener('resize', reflow);

  gTitle.textContent = gTitleField.value = getTitle();

  gTemporaryCheck = document.querySelector('#temporary');
  gTemporaryCheck.checked = isTemporary();
  gTemporaryCheck.addEventListener('change', aEvent => updateParameters());

  l10n.updateDocument();

  updateTree();
  init.done = true;
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
    tree = buildTabChildren({ children: [tabs[1]] });
  }
  else
    tree = buildTabChildren(tabs[0]);
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

function buildTabItem(aTab) {
  const item = document.createElement('li');

  const link = item.appendChild(document.createElement('a'));
  link.href = '#';
  link.setAttribute('title', aTab.title);
  link.dataset.tabId = aTab.id;

  const icon = link.appendChild(document.createElement('img'));
  icon.src = aTab.effectiveFavIconUrl || aTab.favIconUrl;
  icon.onerror = () => {
    item.classList.remove('favicon-loading');
    item.classList.add('use-default-favicon');
  };
  icon.onload = () => {
    item.classList.remove('favicon-loading');
  };
  item.classList.add('favicon-loading');

  const label = link.appendChild(document.createElement('span'));
  label.classList.add('label');
  label.textContent = aTab.title;

  const children = buildTabChildren(aTab);
  if (!children)
    return item;

  const fragment = document.createDocumentFragment();
  fragment.appendChild(item);
  const childrenWrapped = document.createElement('li');
  childrenWrapped.appendChild(children);
  fragment.appendChild(childrenWrapped);
  return fragment;
}

function buildTabChildren(aTab) {
  if (aTab.children && aTab.children.length > 0) {
    const list = document.createElement('ul');
    for (let child of aTab.children) {
      list.appendChild(buildTabItem(child));
    }
    return list;
  }
  return null;
}

function columnizeTree(aTree, aOptions) {
  aOptions = aOptions || {};
  aOptions.columnWidth = aOptions.columnWidth || '20em';

  const style = aTree.style;
  style.columnWidth = style.MozColumnWidth = `calc(${aOptions.columnWidth})`;
  const computedStyle = window.getComputedStyle(aTree, null);
  aTree.columnWidth = Number((computedStyle.MozColumnWidth || computedStyle.columnWidth).replace(/px/, ''));
  style.columnGap   = style.MozColumnGap = '1em';
  style.columnFill  = style.MozColumnFill = 'auto';
  style.columnCount = style.MozColumnCount = 'auto';

  const containerRect = aOptions.containerRect || aTree.parentNode.getBoundingClientRect();
  const maxWidth = containerRect.width;
  if (aTree.columnWidth * 2 <= maxWidth ||
      aOptions.calculateCount) {
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
