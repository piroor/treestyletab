/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import * as PlaceHolderParser from '/extlib/placeholder-parser.js';
import RichConfirm from '/extlib/RichConfirm.js';

import {
  log as internalLogger,
  configs,
  shouldApplyAnimation,
  notify,
  wait,
  sha1sum,
  sanitizeForHTMLText,
  isLinux,
} from './common.js';
import * as ApiTabs from './api-tabs.js';
import * as TreeBehavior from './tree-behavior.js';
import * as Constants from './constants.js';
import * as ContextualIdentities from './contextual-identities.js';
import * as Dialog from './dialog.js';
import * as Permissions from './permissions.js';
import * as UserOperationBlocker from './user-operation-blocker.js';

import Tab from '/common/Tab.js';

function log(...args) {
  internalLogger('common/bookmarks', ...args);
}

let mCreatingCount = 0;

export async function getItemById(id) {
  if (!id)
    return null;
  try {
    const items = await browser.bookmarks.get(id).catch(ApiTabs.createErrorHandler());
    if (items.length > 0)
      return items[0];
  }
  catch(_error) {
  }
  return null;
}

function getAnimationDuration() {
  return shouldApplyAnimation() ? configs.collapseDuration : 0.001;
}

if (Constants.IS_BACKGROUND) {
  browser.runtime.onMessage.addListener((message, sender) => {
    if (!message ||
        typeof message != 'object')
      return;

    switch (message.type) {
      case 'treestyletab:get-bookmark-item-by-id':
        return getItemById(message.id);

      case 'treestyletab:get-bookmark-child-items':
        return browser.bookmarks.getChildren(message.id || 'root________').catch(ApiTabs.createErrorHandler());

      case 'treestyletab:get-bookmark-ancestor-ids':
        return (async () => {
          const ancestorIds = [];
          let item;
          let lastId = message.id;
          do {
            item = await getItemById(lastId);
            if (!item)
              break;
            ancestorIds.push(lastId = item.parentId);
          } while (lastId != 'root________');
          return ancestorIds;
        })();

      case 'treestyletab:create-new-bookmark-folder':
        return (async () => {
          const folder = await browser.bookmarks.create({
            type: 'folder',
            title: browser.i18n.getMessage('bookmarkDialog_newFolder_defaultTitle'),
            parentId: message.parentId,
            ...(typeof message.index == 'number' ? { index: message.index } : {}),
          }).catch(ApiTabs.createErrorHandler());
          return folder;
        })();

      case 'treestyletab:update-bookmark-folder':
        return browser.bookmarks.update(message.id, {
          title: message.title,
        }).catch(ApiTabs.createErrorHandler());

      case 'treestyletab:resize-bookmark-dialog-by':
        return (async () => {
          const win = await browser.windows.get(sender.tab.windowId);
          return browser.windows.update(win.id, {
            width: win.width + (message.width || 0),
            height: win.height + (message.height || 0),
          });
        })();
    }
  });
}

export const FOLDER_CHOOSER_STYLE = `
  .parentIdChooserMiniContainer {
    display: flex;
    flex-direction: row;
  }
  [name="parentId"] {
    display: flex;
    flex-grow: 1;
    margin-right: 0.2em;
    max-width: calc(100% - 2em /* width of the showAllFolders button */ - 0.2em);
  }

  [name="showAllFolders"] {
    display: flex;
    flex-grow: 0;
    width: 2em;
  }

  [name="showAllFolders"]::before {
    -moz-context-properties: fill;
    background: currentColor;
    content: "";
    display: inline-block;
    fill: currentColor;
    height: 1em;
    line-height: 1;
    mask: url("/sidebar/styles/icons/ArrowheadDown.svg") no-repeat center / 60%;
    max-height: 1em;
    max-width: 1em;
    transform-origin: 50% 50%;
    width: 1em;;
  }
  [name="showAllFolders"].expanded::before {
    transform: rotatez(180deg);
  }

  [name="parentIdChooserFullContainer"] {
    flex-grow: 1;
    flex-shrink: 1;
  }
  [name="parentIdChooserFullContainer"]:not(.expanded) {
    display: none;
  }

  [name="parentIdChooserFullContainer"] ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  [name="parentIdChooserFullContainer"] ul[name="parentIdChooserFull"] {
    max-height: 0;
    overflow: visible;
  }

  [name="parentIdChooserFullContainer"] li:not(.expanded) > ul {
    display: none;
  }

  .parentIdChooserFullTreeContainer {
    border: 1px solid;
    margin: 0.5em 0;
    min-height: 10em;
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    flex-shrink: 1;
    overflow-y: auto;
  }

  [name="parentIdChooserFull"] li {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  [name="parentIdChooserFull"] li > label {
    padding: 0.25em;
    white-space: nowrap;
    display: flex;
    user-select: none;
  }

  [name="parentIdChooserFull"] .twisty {
    height: 1em;
    width: 1em;
  }
  [name="parentIdChooserFull"] li.noChild .twisty {
    visibility: hidden;
  }
  [name="parentIdChooserFull"] .twisty::before {
    -moz-context-properties: fill;
    background: currentColor;
    content: "";
    display: inline-block;
    height: 1em;
    line-height: 1;
    mask: url("/sidebar/styles/icons/ArrowheadDown.svg") no-repeat center / 60%;
    max-height: 1em;
    max-width: 1em;
    transform-origin: 50% 50%;
    transform: rotatez(-90deg);
    width: 1em;;
  }
  [name="parentIdChooserFull"] li.expanded > label > .twisty::before {
    transform: rotatez(0deg);
  }

  [name="parentIdChooserFull"] li.focused > label {
    color: highlightText;
    background: highlight;
    outline: 1px dotted;
  }
  [name="parentIdChooserFull"] li.chosen > label > .twisty::before {
    background: highlightText;
  }

  [name="parentIdChooserFull"] li > label > .label-text {
    overflow: hidden;
    text-overflow: ellipsis
  }

  li.editing > label > .label-text {
    display: none;
  }

  li.editing > label > input[type="text"] {
    display: flex;
    flex-grow: 1;
  }
`;

const DIALOG_STYLE = `
  .itemContainer {
    align-items: stretch;
    display: flex;
    flex-direction: column;
    margin: 0.2em 0;
    text-align: start;
  }
  .itemContainer.last {
    flex-grow: 1;
    flex-shrink: 1;
  }

  .itemContainer > label {
    display: flex;
    margin-bottom: 0.2em;
    white-space: nowrap;
  }

  .itemContainer > input[type="text"] {
    display: flex;
  }
  .itemContainer.dialog > input[type="text"] {
    min-width: 30em;
  }

  ${FOLDER_CHOOSER_STYLE}
`;

export async function bookmarkTab(tab, { parentId, showDialog } = {}) {
  try {
    if (!(await Permissions.isGranted(Permissions.BOOKMARKS)))
      throw new Error('not permitted');
  }
  catch(_e) {
    notify({
      title:   browser.i18n.getMessage('bookmark_notification_notPermitted_title'),
      message: browser.i18n.getMessage(`bookmark_notification_notPermitted_message${isLinux() ? '_linux' : ''}`),
      url:     `moz-extension://${location.host}/options/options.html#bookmarksPermissionSection`
    });
    return null;
  }
  const parent = (
    (await getItemById(parentId || configs.defaultBookmarkParentId)) ||
    (await getItemById(configs.$defaults.defaultBookmarkParentId))
  );

  let title    = tab.title;
  let url      = tab.url;
  if (!parentId)
    parentId = parent && parent.id;
  if (showDialog) {
    const windowId = tab.windowId;
    const inline = location.pathname.startsWith('/sidebar/');
    const inlineClass = inline ? 'inline' : 'dialog';
    const BASE_ID = `dialog-${Date.now()}-${parseInt(Math.random() * 65000)}:`;
    const dialogParams = {
      content: `
        <style type="text/css">${DIALOG_STYLE}</style>
        <div class="itemContainer ${inlineClass}"
            ><label for="${BASE_ID}title"
                    accesskey=${JSON.stringify(sanitizeForHTMLText(browser.i18n.getMessage('bookmarkDialog_title_accessKey')))}
                   >${sanitizeForHTMLText(browser.i18n.getMessage('bookmarkDialog_title'))}</label
            ><input id="${BASE_ID}title"
                    type="text"
                    name="title"
                    value=${JSON.stringify(sanitizeForHTMLText(title))}></div
       ><div class="itemContainer ${inlineClass}"
            ><label for="${BASE_ID}url"
                    accesskey=${JSON.stringify(sanitizeForHTMLText(browser.i18n.getMessage('bookmarkDialog_url_accessKey')))}
                   >${sanitizeForHTMLText(browser.i18n.getMessage('bookmarkDialog_url'))}</label
            ><input id="${BASE_ID}url"
                    type="text"
                    name="url"
                    value=${JSON.stringify(sanitizeForHTMLText(url))}></div
       ><div class="itemContainer last ${inlineClass}"
            ><div class="itemContainer"
                 ><label for="${BASE_ID}parentId"
                         accesskey=${JSON.stringify(sanitizeForHTMLText(browser.i18n.getMessage('bookmarkDialog_parentId_accessKey')))}
                        >${sanitizeForHTMLText(browser.i18n.getMessage('bookmarkDialog_parentId'))}</label
                 ><span class="parentIdChooserMiniContainer"
                       ><select id="${BASE_ID}parentId"
                                name="parentId"></select
                       ><button name="showAllFolders"
                                data-no-accept-by-enter="true"
                                title=${JSON.stringify(sanitizeForHTMLText(browser.i18n.getMessage('bookmarkDialog_showAllFolders_tooltip')))}></button
                       ></span></div
            ><div class="itemContainer"
                  name="parentIdChooserFullContainer"
                 ><div class="parentIdChooserFullTreeContainer"
                       tabindex="0"
                       data-no-accept-by-enter="true"
                      ><ul name="parentIdChooserFull"></ul></div
                 ><span><button name="newFolder"
                                accesskey=${JSON.stringify(sanitizeForHTMLText(browser.i18n.getMessage('bookmarkDialog_newFolder_accessKey')))}
                                data-no-accept-by-enter="true"
                               >${sanitizeForHTMLText(browser.i18n.getMessage('bookmarkDialog_newFolder'))}</button
                               ></span></div
       ></div>
      `.trim(),
      async onShown(container, { initFolderChooser, animationDuration, parentId, incrementalSearchTimeout, inline }) {
        if (container.classList.contains('simulation'))
          return;
        container.classList.add('bookmark-dialog');
        const [defaultItem, rootItems] = await Promise.all([
          browser.runtime.sendMessage({ type: 'treestyletab:get-bookmark-item-by-id', id: parentId }),
          browser.runtime.sendMessage({ type: 'treestyletab:get-bookmark-child-items' })
        ]);
        initFolderChooser({
          animationDuration,
          defaultItem,
          rootItems,
          incrementalSearchTimeout,
          container,
          inline,
        });
        container.querySelector('[name="title"]').select();
      },
      inject: {
        initFolderChooser,
        animationDuration: getAnimationDuration(),
        parentId,
        incrementalSearchTimeout: configs.incrementalSearchTimeout,
        inline,
      },
      buttons: [
        browser.i18n.getMessage('bookmarkDialog_accept'),
        browser.i18n.getMessage('bookmarkDialog_cancel')
      ]
    };
    let result;
    if (inline) {
      try {
        UserOperationBlocker.blockIn(windowId, { throbber: false });
        result = await RichConfirm.show(dialogParams);
      }
      catch(_error) {
        result = { buttonIndex: -1 };
      }
      finally {
        UserOperationBlocker.unblockIn(windowId, { throbber: false });
      }
    }
    else {
      result = await Dialog.show(await browser.windows.get(windowId), {
        ...dialogParams,
        modal: true,
        type:  'dialog',
        url:   ((await Permissions.isGranted(Permissions.ALL_URLS)) ? null : '/resources/blank.html'),
        title: browser.i18n.getMessage('bookmarkDialog_dialogTitle_single')
      });
    }
    if (result.buttonIndex != 0)
      return null;
    title    = result.values[`${BASE_ID}title`];
    url      = result.values[`${BASE_ID}url`];
    parentId = result.values[`${BASE_ID}parentId`];
  }

  mCreatingCount++;
  const item = await browser.bookmarks.create({
    parentId, title, url
  }).catch(ApiTabs.createErrorHandler());
  wait(150).then(() => {
    mCreatingCount--;
  });
  return item;
}

export async function bookmarkTabs(tabs, { parentId, index, showDialog, title } = {}) {
  try {
    if (!(await Permissions.isGranted(Permissions.BOOKMARKS)))
      throw new Error('not permitted');
  }
  catch(_e) {
    notify({
      title:   browser.i18n.getMessage('bookmark_notification_notPermitted_title'),
      message: browser.i18n.getMessage('bookmark_notification_notPermitted_message'),
      url:     `moz-extension://${location.host}/options/options.html#bookmarksPermissionSection`
    });
    return null;
  }
  const now = new Date();
  const year = String(now.getFullYear());
  if (!title)
    title = PlaceHolderParser.process(configs.bookmarkTreeFolderName, (name, _rawArgs, ...args) => {
      switch (name.toLowerCase()) {
        case 'any':
          for (const arg of args) {
            if (!!arg)
              return arg;
          }
          return '';

        case 'title':
          return tabs[0].title;

        case 'group':
          return tabs[0].isGroupTab ? tabs[0].title : '';

        case 'url':
          return tabs[0].url;

        case 'short_year':
        case 'shortyear':
          return year.slice(-2);

        case 'full_year':
        case 'fullyear':
        case 'year':
          return year;

        case 'month':
          return String(now.getMonth() + 1).padStart(2, '0');

        case 'date':
          return String(now.getDate()).padStart(2, '0');

        case 'hour':
        case 'hours':
          return String(now.getHours()).padStart(2, '0');

        case 'min':
        case 'minute':
        case 'minutes':
          return String(now.getMinutes()).padStart(2, '0');

        case 'sec':
        case 'second':
        case 'seconds':
          return String(now.getSeconds()).padStart(2, '0');

        case 'msec':
        case 'millisecond':
        case 'milliseconds':
          return String(now.getSeconds()).padStart(3, '0');
      }
    });
  const folderParams = {
    type: 'folder',
    title
  };
  let parent;
  if (parentId) {
    parent = await getItemById(parentId);
    if (index !== undefined)
      folderParams.index = index;
  }
  else {
    parent = await getItemById(configs.defaultBookmarkParentId);
  }
  if (!parent)
    parent = await getItemById(configs.$defaults.defaultBookmarkParentId);
  if (parent)
    folderParams.parentId = parent.id;

  if (showDialog) {
    const windowId = tabs[0].windowId;
    const inline = location.pathname.startsWith('/sidebar/');
    const inlineClass = inline ? 'inline' : 'dialog';
    const BASE_ID = `dialog-${Date.now()}-${parseInt(Math.random() * 65000)}:`;
    const dialogParams = {
      content: `
        <style type="text/css">${DIALOG_STYLE}</style>
        <div class="itemContainer ${inlineClass}"
            ><label for="${BASE_ID}title"
                    accesskey=${JSON.stringify(sanitizeForHTMLText(browser.i18n.getMessage('bookmarkDialog_title_accessKey')))}
                   >${sanitizeForHTMLText(browser.i18n.getMessage('bookmarkDialog_title'))}</label
            ><input id="${BASE_ID}title"
                    type="text"
                    name="title"
                    value=${JSON.stringify(sanitizeForHTMLText(title))}></div
       ><div class="itemContainer last ${inlineClass}"
            ><div class="itemContainer"
                 ><label for="${BASE_ID}parentId"
                         accesskey=${JSON.stringify(sanitizeForHTMLText(browser.i18n.getMessage('bookmarkDialog_parentId_accessKey')))}
                        >${sanitizeForHTMLText(browser.i18n.getMessage('bookmarkDialog_parentId'))}</label
                 ><span class="parentIdChooserMiniContainer"
                       ><select id="${BASE_ID}parentId"
                                name="parentId"></select
                       ><button name="showAllFolders"
                                data-no-accept-by-enter="true"
                                title=${JSON.stringify(sanitizeForHTMLText(browser.i18n.getMessage('bookmarkDialog_showAllFolders_tooltip')))}></button
                       ></span></div
            ><div class="itemContainer"
                  name="parentIdChooserFullContainer"
                 ><div class="parentIdChooserFullTreeContainer"
                       tabindex="0"
                       data-no-accept-by-enter="true"
                      ><ul name="parentIdChooserFull"></ul></div
                 ><span><button name="newFolder"
                                accesskey=${JSON.stringify(sanitizeForHTMLText(browser.i18n.getMessage('bookmarkDialog_newFolder_accessKey')))}
                                data-no-accept-by-enter="true"
                               >${sanitizeForHTMLText(browser.i18n.getMessage('bookmarkDialog_newFolder'))}</button
                               ></span></div
       ></div>
      `.trim(),
      async onShown(container, { initFolderChooser, animationDuration, parentId, incrementalSearchTimeout }) {
        if (container.classList.contains('simulation'))
          return;
        container.classList.add('bookmark-dialog');
        const [defaultItem, rootItems] = await Promise.all([
          browser.runtime.sendMessage({ type: 'treestyletab:get-bookmark-item-by-id', id: parentId }),
          browser.runtime.sendMessage({ type: 'treestyletab:get-bookmark-child-items' })
        ]);
        initFolderChooser({
          animationDuration,
          defaultItem,
          rootItems,
          incrementalSearchTimeout,
          container,
          inline,
        });
        container.querySelector('[name="title"]').select();
      },
      inject: {
        initFolderChooser,
        animationDuration: getAnimationDuration(),
        parentId: folderParams.parentId,
        incrementalSearchTimeout: configs.incrementalSearchTimeout,
        inline,
      },
      buttons: [
        browser.i18n.getMessage('bookmarkDialog_accept'),
        browser.i18n.getMessage('bookmarkDialog_cancel')
      ]
    };
    let result;
    if (inline) {
      try {
        UserOperationBlocker.blockIn(windowId, { throbber: false });
        result = await RichConfirm.show(dialogParams);
      }
      catch(_error) {
        result = { buttonIndex: -1 };
      }
      finally {
        UserOperationBlocker.unblockIn(windowId, { throbber: false });
      }
    }
    else {
      result = await Dialog.show(await browser.windows.get(windowId), {
        ...dialogParams,
        modal: true,
        type:  'dialog',
        url:   ((await Permissions.isGranted(Permissions.ALL_URLS)) ? null : '/resources/blank.html'),
        title: browser.i18n.getMessage('bookmarkDialog_dialogTitle_multiple')
      });
    }
    if (result.buttonIndex != 0)
      return null;
    folderParams.title    = result.values[`${BASE_ID}title`];
    folderParams.parentId = result.values[`${BASE_ID}parentId`];
  }

  const toBeCreatedCount = tabs.length + 1;
  mCreatingCount += toBeCreatedCount;

  const titles = getTitlesWithTreeStructure(tabs);
  const folder = await browser.bookmarks.create(folderParams).catch(ApiTabs.createErrorHandler());
  for (let i = 0, maxi = tabs.length; i < maxi; i++) {
    await browser.bookmarks.create({
      parentId: folder.id,
      index:    i,
      title:    titles[i],
      url:      tabs[i].url
    }).catch(ApiTabs.createErrorSuppressor());
  }

  wait(150).then(() => {
    mCreatingCount -= toBeCreatedCount;
  });

  return folder;
}

function getTitlesWithTreeStructure(tabs) {
  const minLevel = Math.min(...tabs.map(tab => parseInt(tab.$TST.getAttribute(Constants.kLEVEL) || '0')));
  const titles = [];
  for (let i = 0, maxi = tabs.length; i < maxi; i++) {
    const tab = tabs[i];
    const title = tab.title;
    const level = parseInt(tab.$TST.getAttribute(Constants.kLEVEL) || '0') - minLevel;
    let prefix = '';
    for (let j = 0; j < level; j++) {
      prefix += '>';
    }
    if (prefix)
      titles.push(`${prefix} ${title}`);
    else
      titles.push(title.replace(/^>+ /, '')); // if the page title has marker-like prefix, we need to remove it.
  }
  return titles;
}

export async function initFolderChooser({ container, ...params } = {}) {
  const miniList = container.querySelector('select[name="parentId"]');
  const fullList = container.querySelector('ul[name="parentIdChooserFull"]');
  const fullListFocusibleContainer = container.querySelector('.parentIdChooserFullTreeContainer');
  const fullContainer = container.querySelector('[name="parentIdChooserFullContainer"]');
  const expandeFullListButton = container.querySelector('button[name="showAllFolders"]');
  const newFolderButton = container.querySelector('button[name="newFolder"]');

  const BASE_ID = `folderChooser-${Date.now()}-${parseInt(Math.random() * 65000)}:`;

  const ensureItemVisible = item => {
    const itemRect = item.querySelector('label').getBoundingClientRect();
    const containerRect = fullListFocusibleContainer.getBoundingClientRect();
    if (itemRect.top < containerRect.top) {
      fullListFocusibleContainer.scrollBy(0, itemRect.top - containerRect.top - (itemRect.height / 2));
    }
    else if (itemRect.bottom > containerRect.bottom) {
      fullListFocusibleContainer.scrollBy(0, itemRect.bottom - containerRect.bottom + (itemRect.height / 2));
    }
  };

  const cancelEvent = event => {
    event.stopImmediatePropagation();
    event.preventDefault();
  };

  // Initialize mini chooser
  for (const rootItem of params.rootItems) {
    const item = miniList.appendChild(document.createElement('option'));
    item.textContent = rootItem.title;
    item.value = rootItem.id;
  }

  miniList.appendChild(document.createElement('hr'));
  const expanderOption = miniList.appendChild(document.createElement('option'));
  expanderOption.textContent = browser.i18n.getMessage('bookmarkDialog_showAllFolders_label');
  expanderOption.setAttribute('value', `${BASE_ID}expandChooser`);

  miniList.appendChild(document.createElement('hr'));
  const lastChosenOption = miniList.appendChild(document.createElement('option'));

  let lastChosenItem = params.defaultItem ||
    params.defaultValue && await getItemById(params.defaultValue) ||
    null;
  const getLastChosenItem = () => {
    return lastChosenItem || miniList.firstChild.$item || null;
  };

  const updateLastChosenOption = () => {
    if (lastChosenItem) {
      lastChosenOption.value       = lastChosenItem.id;
      lastChosenOption.textContent = lastChosenItem.title;
      lastChosenOption.style.display = '';
    }
    else {
      lastChosenOption.style.display = 'none';
    }
    miniList.value = getLastChosenItem().id;
  };
  updateLastChosenOption();

  let expanded = false;
  let fullChooserHeight = 0;
  const toggleFullChooser = async () => {
    expanded = !expanded;
    fullContainer.classList.toggle('expanded', expanded);
    expandeFullListButton.classList.toggle('expanded', expanded);
    if (!params.inline) {
      fullChooserHeight = Math.max(fullChooserHeight, 150);
      await browser.runtime.sendMessage({
        type: 'treestyletab:resize-bookmark-dialog-by',
        width: 0,
        height: expanded ? fullChooserHeight : -fullChooserHeight,
      });
    }
    if (lastChosenItem) {
      const item = fullList.querySelector(`li[data-id="${lastChosenItem.id}"]`);
      if (item)
        ensureItemVisible(item);
    }
  };

  // Initialize expander
  const getElementTarget = event => {
    return event.target.nodeType == Node.ELEMENT_NODE ?
      event.target :
      event.target.parentNode;;
  };

  expandeFullListButton.addEventListener('click', event => {
    if (event.button != 0)
      return;
    toggleFullChooser();
  });
  expandeFullListButton.addEventListener('keydown', event => {
    const elementTarget = getElementTarget(event);
    if (elementTarget != expandeFullListButton)
      return;

    switch (event.key) {
      case 'Enter':
        cancelEvent(event);
      case 'Space':
        toggleFullChooser();
        break;

      default:
        break;
    }
  }, { capture: true });

  // Initialize full chooser
  fullList.level = 0;

  const exitAllEditings = () => {
    for (const item of fullList.querySelectorAll('li.editing')) {
      item.$exitTitleEdit();
    }
  };

  const getTargetItem = event => {
    const elementTarget = getElementTarget(event);
    return elementTarget?.closest('li');
  };

  const onItemClicked = item => {
    if (!item)
      return;

    exitAllEditings();

    for (const oldFocused of fullListFocusibleContainer.querySelectorAll('.focused')) {
      if (oldFocused == item)
        continue;
      oldFocused.classList.remove('focused');
    }
    item.classList.add('focused');
    lastChosenItem = item.$item;

    ensureItemVisible(item);
    updateLastChosenOption();
  };

  const onCommand = event => {
    const item = getTargetItem(event);
    if (!item)
      return;

    item.classList.toggle('expanded');
    if (item.classList.contains('expanded'))
      item.$completeFolderItem();

    onItemClicked(item);
  };

  fullListFocusibleContainer.addEventListener('dblclick', event => {
    if (event.button != 0)
      return;
    if (getElementTarget(event)?.closest('.twisty'))
      return;
    const item = getTargetItem(event);
    if (item)
      item.$enterTitleEdit();
  });
  fullListFocusibleContainer.addEventListener('click', event => {
    if (event.button != 0)
      return;
    const target = getElementTarget(event);
    if (target?.closest('.twisty')) {
      onCommand(event);
    }
    else if (!target?.closest('input[type="text"]')) {
      onItemClicked(getTargetItem(event));
    }
  });
  fullListFocusibleContainer.addEventListener('keydown', event => {
    if (getElementTarget(event)?.closest('input[type="text"]') &&
        event.key != 'Enter')
      return;

    const focusibleItems = [...fullList.querySelectorAll('li:not(li:not(.expanded) li)')];
    const focusedItem = fullList.querySelector('li.focused');
    const index = focusedItem ? focusibleItems.indexOf(focusedItem) : -1;
    switch (event.key) {
      case 'Enter':
        cancelEvent(event);
        if (focusedItem && focusedItem.matches('.editing'))
          focusedItem.$exitTitleEdit();
        onCommand(event);
        break;

      case 'ArrowUp': {
        cancelEvent(event);
        const toBeFocused = focusibleItems[(index == 0 ? focusibleItems.length : index) - 1];
        onItemClicked(toBeFocused);
      }; break;

      case 'ArrowDown': {
        cancelEvent(event);
        const toBeFocused = focusibleItems[index == focusibleItems.length - 1 ? 0 : index + 1];
        onItemClicked(toBeFocused);
      }; break;

      case 'ArrowRight':
        cancelEvent(event);
        if (!focusedItem.classList.contains('expanded')) {
          focusedItem.classList.add('expanded');
          focusedItem.$completeFolderItem();
        }
        else {
          const firstChild = focusedItem.querySelector('li');
          if (firstChild)
            onItemClicked(firstChild);
        }
        break;

      case 'ArrowLeft':
        cancelEvent(event);
        if (focusedItem.classList.contains('expanded')) {
          focusedItem.classList.remove('expanded');
        }
        else {
          const nearestAncestor = focusedItem.parentNode.closest('li');
          if (nearestAncestor)
            onItemClicked(nearestAncestor);
        }
        break;

      case 'PageUp': {
        cancelEvent(event);
        const toBeFocusedIndex = Math.min(focusibleItems.length - 1, Math.max(0, index - Math.floor(fullListFocusibleContainer.offsetHeight / focusedItem.offsetHeight) + 1));
        const toBeFocused = focusibleItems[toBeFocusedIndex];
        onItemClicked(toBeFocused);
      }; break;

      case 'PageDown': {
        cancelEvent(event);
        const toBeFocusedIndex = Math.min(focusibleItems.length - 1, Math.max(0, index + Math.floor(fullListFocusibleContainer.offsetHeight / focusedItem.offsetHeight) - 1));
        const toBeFocused = focusibleItems[toBeFocusedIndex];
        onItemClicked(toBeFocused);
      }; break;

      case 'Home':
        cancelEvent(event);
        onItemClicked(focusibleItems[0]);
        break;

      case 'End':
        cancelEvent(event);
        onItemClicked(focusibleItems[focusibleItems.length - 1]);
        break;
    }
  }, { capture: true });

  container.addEventListener('focus', event => {
    if (!getElementTarget(event)?.closest('input[type="text"], .parentIdChooserFullTreeContainer'))
      exitAllEditings();
  }, { capture: true });

  container.addEventListener('blur', event => {
    if (getElementTarget(event)?.closest('input[type="text"]')) {
      const editingItem = fullList.querySelector('li.editing');
      if (editingItem)
        editingItem.$exitTitleEdit();
    }
  }, { capture: true });

  miniList.addEventListener('change', () => {
    if (miniList.value == `${BASE_ID}expandChooser`) {
      if (!fullContainer.classList.contains('expanded'))
        toggleFullChooser();
      miniList.value = getLastChosenItem().id;
      return;
    }

    const fullListItem = fullList.querySelector(`li[data-id="${miniList.value}"]`);
    if (fullListItem)
      onItemClicked(fullListItem);
  });

  const createNewSubFolder = async () => {
    const folder = await browser.runtime.sendMessage({
      type:     'treestyletab:create-new-bookmark-folder',
      parentId: getLastChosenItem().id,
    });
    const parentItem = fullList.querySelector(`li[data-id="${folder.parentId}"]`);
    if (!parentItem)
      return;
    parentItem.$invalidate();
    parentItem.classList.add('expanded');
    await parentItem.$completeFolderItem();
    const folderItem = parentItem.querySelector(`li[data-id="${folder.id}"]`);
    if (!folderItem)
      return;

    onItemClicked(folderItem);
    folderItem.$enterTitleEdit();
  };

  newFolderButton.addEventListener('click', event => {
    if (event.button != 0)
      return;
    createNewSubFolder();
  });
  newFolderButton.addEventListener('keydown', event => {
    const elementTarget = getElementTarget(event);
    if (elementTarget != newFolderButton)
      return;

    switch (event.key) {
      case 'Enter':
        cancelEvent(event);
      case 'Space':
        createNewSubFolder();
        break;

      default:
        break;
    }
  }, { capture: true });

  const generateFolderItem = (folder, level) => {
    const item = document.createElement('li');
    item.$item = folder;
    item.setAttribute('data-id', folder.id);
    const title = folder.title || browser.i18n.getMessage('bookmarkFolderChooser_blank');
    const label = item.appendChild(document.createElement('label'));
    label.setAttribute('style', `padding-left: calc(1.25em * ${level} + 0.25em);`);
    label.setAttribute('title', title);
    const twisty = label.appendChild(document.createElement('span'));
    twisty.setAttribute('class', 'twisty');
    const text = label.appendChild(document.createElement('div'));
    text.setAttribute('class', 'label-text');
    text.textContent = title;
    return item;
  };

  const buildItems = async (items, container) => {
    const createdItems = [];
    for (const item of items) {
      if (item.type == 'bookmark' &&
          /^place:parent=([^&]+)$/.test(item.url)) { // alias for special folders
        const realItem = await browser.runtime.sendMessage({
          type: 'treestyletab:get-bookmark-item-by-id',
          id:   RegExp.$1
        });
        item.id    = realItem.id;
        item.type  = realItem.type;
        item.title = realItem.title;
      }
      if (item.type != 'folder')
        continue;

      if (container.querySelector(`li[data-id="${item.id}"]`))
        continue;

      const folderItem = generateFolderItem(item, container.level);
      container.insertBefore(folderItem, 'index' in item ? container.childNodes[item.index] : null);
      createdItems.push(folderItem);
      folderItem.$completeFolderItem = async () => {
        if (!item.$fetched) {
          item.$fetched = true;
          item.children = (await browser.runtime.sendMessage({
            type: 'treestyletab:get-bookmark-child-items',
            id:   item.id
          })).filter(item => item.type == 'folder');
        }
        folderItem.classList.toggle('noChild', !item.children || item.children.length == 0);
        if (item.children &&
            item.children.length > 0) {
          let subFolderContainer = folderItem.querySelector('ul');;
          if (!subFolderContainer) {
            subFolderContainer = folderItem.appendChild(document.createElement('ul'));
            subFolderContainer.level = container.level + 1;
          }
          await buildItems(item.children, subFolderContainer);
        }
        return folderItem;
      };
      folderItem.$invalidate = () => {
        item.$fetched = false;
      };
      let titleField;
      folderItem.$enterTitleEdit = async () => {
        exitAllEditings();
        if (!titleField) {
          const label = folderItem.querySelector('label');
          folderItem.classList.add('editing');
          titleField = label.appendChild(document.createElement('input'));
          titleField.setAttribute('type', 'text');
          label.appendChild(titleField);
          titleField.value = item.title || browser.i18n.getMessage('bookmarkFolderChooser_blank');
        }
        titleField.focus();
        titleField.select();
      };
      folderItem.$exitTitleEdit = async () => {
        if (!titleField)
          return;
        browser.runtime.sendMessage({
          type:  'treestyletab:update-bookmark-folder',
          id:    item.id,
          title: titleField.value,
        });
        item.title =
           folderItem.querySelector('.label-text').textContent = titleField.value;
        folderItem.querySelector('label').setAttribute('title', titleField.value);
        if (lastChosenItem?.id == item.id)
          lastChosenItem.title = item.title;
        titleField.parentNode.removeChild(titleField);
        titleField = null;
        folderItem.classList.remove('editing');
        updateLastChosenOption();
      };
    }
    return createdItems;
  };

  const topLevelItems = await buildItems(params.rootItems, fullList);
  let itemToBeFocused = topLevelItems.length > 0 && topLevelItems[0];
  if (lastChosenItem) {
    const ancestorIds = await browser.runtime.sendMessage({
      type: 'treestyletab:get-bookmark-ancestor-ids',
      id:   lastChosenItem.id,
    });
    for (const id of [...ancestorIds.reverse(), lastChosenItem.id]) {
      if (id == 'root________')
        continue;

      const item = fullList.querySelector(`li[data-id="${id}"]`);
      if (!item)
        break;

      itemToBeFocused = item;
      item.classList.add('expanded');
      await item.$completeFolderItem();
    }
  }
  if (itemToBeFocused)
    itemToBeFocused.classList.add('focused');
}

let mCreatedBookmarks = [];
let mIsTracking = false;

async function onBookmarksCreated(id, bookmark) {
  if (!mIsTracking)
    return;

  log('onBookmarksCreated ', { id, bookmark });

  if (mCreatingCount > 0)
    return;

  mCreatedBookmarks.push(bookmark);
  reserveToGroupCreatedBookmarks();
}

function reserveToGroupCreatedBookmarks() {
  if (reserveToGroupCreatedBookmarks.reserved)
    clearTimeout(reserveToGroupCreatedBookmarks.reserved);
  reserveToGroupCreatedBookmarks.reserved = setTimeout(() => {
    reserveToGroupCreatedBookmarks.reserved = null;
    tryGroupCreatedBookmarks();
  }, 250);
}
reserveToGroupCreatedBookmarks.reserved = null;
reserveToGroupCreatedBookmarks.retryCount = 0;

async function tryGroupCreatedBookmarks() {
  log('tryGroupCreatedBookmarks ', mCreatedBookmarks);

  if (!configs.autoCreateFolderForBookmarksFromTree) {
    log(' => autoCreateFolderForBookmarksFromTree is false');
    return;
  }

  const lastDraggedTabs = configs.lastDraggedTabs;
  if (lastDraggedTabs &&
      lastDraggedTabs.tabIds.length > mCreatedBookmarks.length) {
    if (reserveToGroupCreatedBookmarks.retryCount++ < 10) {
      return reserveToGroupCreatedBookmarks();
    }
    else {
      reserveToGroupCreatedBookmarks.retryCount = 0;
      mCreatedBookmarks = [];
      configs.lastDraggedTabs = null;
      log(' => timeout');
      return;
    }
  }
  reserveToGroupCreatedBookmarks.retryCount = 0;

  const bookmarks = mCreatedBookmarks;
  mCreatedBookmarks = [];
  if (lastDraggedTabs) {
    // accept only bookmarks from dragged tabs
    const digest = await sha1sum(bookmarks.map(tab => tab.url).join('\n'));
    configs.lastDraggedTabs = null;
    if (digest != lastDraggedTabs.urlsDigest) {
      log(' => digest mismatched ', { digest, last: lastDraggedTabs.urlsDigest });
      return;
    }
  }

  if (bookmarks.length < 2) {
    log(' => ignore single bookmark');
    return;
  }

  {
    // Do nothing if multiple bookmarks are created under
    // multiple parent folders by sync.
    const parentIds = new Set();
    for (const bookmark of bookmarks) {
      parentIds.add(bookmark.parentId);
    }
    log('parentIds: ', parentIds);
    if (parentIds.size > 1) {
      log(' => ignore bookmarks created under multiple folders');
      return;
    }
  }

  const tabs = lastDraggedTabs ?
    lastDraggedTabs.tabIds.map(id => Tab.get(id)) :
    (await Promise.all(bookmarks.map(async bookmark => {
      const tabs = await browser.tabs.query({ url: bookmark.url });
      if (tabs.length == 0)
        return null;
      const tab = tabs.find(tab => tab.highlighted) || tabs[0];
      return Tab.get(tab);
    }))).filter(tab => !!tab);
  log('tabs: ', tabs);
  if (tabs.length != bookmarks.length) {
    log(' => ignore bookmarks created from non-tab sources');
    return;
  }

  const treeStructure = TreeBehavior.getTreeStructureFromTabs(tabs);
  log('treeStructure: ', treeStructure);
  const topLevelTabsCount = treeStructure.filter(item => item.parent < 0).length;
  if (topLevelTabsCount == treeStructure.length) {
    log(' => no need to group bookmarks from dragged flat tabs');
    return;
  }

  let titles = getTitlesWithTreeStructure(tabs);
  if (tabs[0].$TST.isGroupTab &&
      titles.filter(title => !/^>/.test(title)).length == 1) {
    log('delete needless bookmark for a group tab');
    browser.bookmarks.remove(bookmarks[0].id);
    tabs.shift();
    bookmarks.shift();
    titles = getTitlesWithTreeStructure(tabs);
  }
  log('titles: ', titles);

  log('save tree structure to bookmarks');
  for (let i = 0, maxi = bookmarks.length; i < maxi; i++) {
    const title = titles[i];
    if (title == tabs[i].title)
      continue;
    browser.bookmarks.update(bookmarks[i].id, { title });
  }

  log('ready to group bookmarks under a folder');

  const parentId = bookmarks[0].parentId;
  {
    // Do nothing if all bookmarks are created under a new
    // blank folder.
    const allChildren = await browser.bookmarks.getChildren(parentId);
    log('allChildren.length vs bookmarks.length: ', allChildren.length, bookmarks.length);
    if (allChildren.length == bookmarks.length) {
      log(' => no need to create folder for bookmarks under a new blank folder');
      return;
    }
  }

  log('create a folder for grouping');
  mCreatingCount++;
  const folder = await browser.bookmarks.create({
    type:  'folder',
    title: bookmarks[0].title,
    index: bookmarks[0].index,
    parentId
  }).catch(ApiTabs.createErrorHandler());
  wait(150).then(() => {
    mCreatingCount--;
  });

  log('move into a folder');
  let movedCount = 0;
  for (const bookmark of bookmarks) {
    await browser.bookmarks.move(bookmark.id, {
      parentId: folder.id,
      index:    movedCount++
    });
  }
}

if (Constants.IS_BACKGROUND &&
    browser.bookmarks &&
    browser.bookmarks.onCreated) { // already granted
  browser.bookmarks.onCreated.addListener(onBookmarksCreated);
  mIsTracking = true;
}

export async function startTracking() {
  if (!mIsTracking ||
      !Constants.IS_BACKGROUND)
    return;

  mIsTracking = true;
  const granted = await Permissions.isGranted(Permissions.BOOKMARKS);
  if (granted && !browser.bookmarks.onCreated.hasListener(onBookmarksCreated))
    browser.bookmarks.onCreated.addListener(onBookmarksCreated);
}


export const BOOKMARK_TITLE_DESCENDANT_MATCHER = /^(>+) /;

export async function getTreeStructureFromBookmarkFolder(folderOrId) {
  const items = folderOrId.children || await browser.bookmarks.getChildren(folderOrId.id || folderOrId);
  return getTreeStructureFromBookmarks(items.filter(item => item.type == 'bookmark'));
}

export function getTreeStructureFromBookmarks(items) {
  const lastItemIndicesWithLevel = new Map();
  let lastMaxLevel = 0;
  return items.reduce((result, item, index) => {
    const { cookieStoreId, url } = ContextualIdentities.getIdFromBookmark(item);
    if (cookieStoreId) {
      item.cookieStoreId = cookieStoreId;
      if (url)
        item.url = url;
    }

    let level = 0;
    if (lastItemIndicesWithLevel.size > 0 &&
        item.title.match(BOOKMARK_TITLE_DESCENDANT_MATCHER)) {
      level = RegExp.$1.length;
      if (level - lastMaxLevel > 1) {
        level = lastMaxLevel + 1;
      }
      else {
        while (lastMaxLevel > level) {
          lastItemIndicesWithLevel.delete(lastMaxLevel--);
        }
      }
      lastItemIndicesWithLevel.set(level, index);
      lastMaxLevel = level;
      result.push(lastItemIndicesWithLevel.get(level - 1) - lastItemIndicesWithLevel.get(0));
      item.title = item.title.replace(BOOKMARK_TITLE_DESCENDANT_MATCHER, '')
    }
    else {
      result.push(-1);
      lastItemIndicesWithLevel.clear();
      lastItemIndicesWithLevel.set(0, index);
    }
    return result;
  }, []);
}


