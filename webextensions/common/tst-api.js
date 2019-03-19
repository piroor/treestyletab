/* ***** BEGIN LICENSE BLOCK ***** 
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the Tree Style Tab.
 *
 * The Initial Developer of the Original Code is YUKI "Piro" Hiroshi.
 * Portions created by the Initial Developer are Copyright (C) 2011-2018
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): YUKI "Piro" Hiroshi <piro.outsider.reflex@gmail.com>
 *                 wanabe <https://github.com/wanabe>
 *                 Tetsuharu OHZEKI <https://github.com/saneyuki>
 *                 Xidorn Quan <https://github.com/upsuper> (Firefox 40+ support)
 *                 lv7777 (https://github.com/lv7777)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ******/
'use strict';

import TabFavIconHelper from '/extlib/TabFavIconHelper.js';

import {
  log as internalLogger,
  wait,
  configs
} from './common.js';
import * as Constants from './constants.js';
import * as ApiTabs from '/common/api-tabs.js';
import * as TabsStore from './tabs-store.js';
import * as Sidebar from './sidebar.js';

import Tab from './Tab.js';

function log(...args) {
  internalLogger('common/tst-api', ...args);
}

export const kREGISTER_SELF         = 'register-self';
export const kUNREGISTER_SELF       = 'unregister-self';
export const kWAIT_FOR_SHUTDOWN     = 'wait-for-shutdown';
export const kPING                  = 'ping';
export const kNOTIFY_READY          = 'ready';
export const kNOTIFY_SHUTDOWN       = 'shutdown'; // defined but not notified for now.
export const kNOTIFY_SIDEBAR_SHOW   = 'sidebar-show';
export const kNOTIFY_SIDEBAR_HIDE   = 'sidebar-hide';
export const kNOTIFY_TAB_CLICKED    = 'tab-clicked'; // for backward compatibility
export const kNOTIFY_TAB_MOUSEDOWN  = 'tab-mousedown';
export const kNOTIFY_TAB_MOUSEUP    = 'tab-mouseup';
export const kNOTIFY_TABBAR_CLICKED = 'tabbar-clicked'; // for backward compatibility
export const kNOTIFY_TABBAR_MOUSEDOWN = 'tabbar-mousedown';
export const kNOTIFY_TABBAR_MOUSEUP = 'tabbar-mouseup';
export const kNOTIFY_TAB_MOUSEMOVE  = 'tab-mousemove';
export const kNOTIFY_TAB_MOUSEOVER  = 'tab-mouseover';
export const kNOTIFY_TAB_MOUSEOUT   = 'tab-mouseout';
export const kNOTIFY_TAB_DRAGREADY  = 'tab-dragready';
export const kNOTIFY_TAB_DRAGCANCEL = 'tab-dragcancel';
export const kNOTIFY_TAB_DRAGSTART  = 'tab-dragstart';
export const kNOTIFY_TAB_DRAGENTER  = 'tab-dragenter';
export const kNOTIFY_TAB_DRAGEXIT   = 'tab-dragexit';
export const kNOTIFY_TAB_DRAGEND    = 'tab-dragend';
export const kNOTIFY_NATIVE_TAB_DRAGSTART = 'native-tab-dragstart';
export const kSTART_CUSTOM_DRAG     = 'start-custom-drag';
export const kNOTIFY_TRY_MOVE_FOCUS_FROM_CLOSING_CURRENT_TAB = 'try-move-focus-from-closing-current-tab';
export const kGET_TREE              = 'get-tree';
export const kATTACH                = 'attach';
export const kDETACH                = 'detach';
export const kINDENT                = 'indent';
export const kDEMOTE                = 'demote';
export const kOUTDENT               = 'outdent';
export const kPROMOTE               = 'promote';
export const kMOVE_UP               = 'move-up';
export const kMOVE_TO_START         = 'move-to-start';
export const kMOVE_DOWN             = 'move-down';
export const kMOVE_TO_END           = 'move-to-end';
export const kMOVE_BEFORE           = 'move-before';
export const kMOVE_AFTER            = 'move-after';
export const kFOCUS                 = 'focus';
export const kDUPLICATE             = 'duplicate';
export const kGROUP_TABS            = 'group-tabs';
export const kOPEN_IN_NEW_WINDOW    = 'open-in-new-window';
export const kREOPEN_IN_CONTAINER   = 'reopen-in-container';
export const kGET_TREE_STRUCTURE    = 'get-tree-structure';
export const kSET_TREE_STRUCTURE    = 'set-tree-structure';
export const kCOLLAPSE_TREE         = 'collapse-tree';
export const kEXPAND_TREE           = 'expand-tree';
export const kADD_TAB_STATE         = 'add-tab-state';
export const kREMOVE_TAB_STATE      = 'remove-tab-state';
export const kSCROLL                = 'scroll';
export const kSCROLL_LOCK           = 'scroll-lock';
export const kSCROLL_UNLOCK         = 'scroll-unlock';
export const kNOTIFY_SCROLLED       = 'scrolled';
export const kBLOCK_GROUPING        = 'block-grouping';
export const kUNBLOCK_GROUPING      = 'unblock-grouping';
export const kGRANT_TO_REMOVE_TABS  = 'grant-to-remove-tabs';

export const kCONTEXT_MENU_UPDATED    = 'fake-contextMenu-updated';
export const kCONTEXT_MENU_GET_ITEMS  = 'fake-contextMenu-get-items';
export const kCONTEXT_MENU_OPEN       = 'fake-contextMenu-open';
export const kCONTEXT_MENU_CREATE     = 'fake-contextMenu-create';
export const kCONTEXT_MENU_UPDATE     = 'fake-contextMenu-update';
export const kCONTEXT_MENU_REMOVE     = 'fake-contextMenu-remove';
export const kCONTEXT_MENU_REMOVE_ALL = 'fake-contextMenu-remove-all';
export const kCONTEXT_MENU_CLICK      = 'fake-contextMenu-click';
export const kCONTEXT_MENU_SHOWN      = 'fake-contextMenu-shown';
export const kCONTEXT_MENU_HIDDEN     = 'fake-contextMenu-hidden';

export const kCONTEXT_ITEM_CHECKED_STATUS_CHANGED = 'fake-contextMenu-item-checked-status-changed';

export const kCOMMAND_BROADCAST_API_REGISTERED   = 'treestyletab:broadcast-registered';
export const kCOMMAND_BROADCAST_API_UNREGISTERED = 'treestyletab:broadcast-unregistered';
export const kCOMMAND_REQUEST_INITIALIZE         = 'treestyletab:request-initialize';
export const kCOMMAND_REQUEST_CONTROL_STATE      = 'treestyletab:request-control-state';

const kCONTEXT_BACKEND  = 1;
const kCONTEXT_FRONTEND = 2;

let mContext = null;
const mAddons = new Map();
let mScrollLockedBy    = {};
let mGroupingBlockedBy = {};

export function getAddon(id) {
  return mAddons.get(id);
}

function registerAddon(id, addon) {
  log('addon is registered: ', id, addon);

  // inherit properties from last effective value
  const oldAddon = mAddons.get(id);
  if (oldAddon) {
    if (!('listeningTypes' in addon) && 'listeningTypes' in oldAddon)
      addon.listeningTypes = oldAddon.listeningTypes;
    if (!('style' in addon) && 'style' in oldAddon)
      addon.style = oldAddon.style;
  }

  if (!addon.listeningTypes) {
    // for backward compatibility, send all message types available on TST 2.4.16 by default.
    addon.listeningTypes = [
      kNOTIFY_READY,
      kNOTIFY_SHUTDOWN,
      kNOTIFY_TAB_CLICKED,
      kNOTIFY_TAB_MOUSEDOWN,
      kNOTIFY_TAB_MOUSEUP,
      kNOTIFY_TABBAR_CLICKED,
      kNOTIFY_TABBAR_MOUSEDOWN,
      kNOTIFY_TABBAR_MOUSEUP
    ];
  }
  mAddons.set(id, addon);
}

function unregisterAddon(id) {
  log('addon is unregistered: ', id, mAddons.get(id));
  mAddons.delete(id);
  delete mScrollLockedBy[id];
  delete mGroupingBlockedBy[id];
}

function getAddons() {
  return mAddons.entries();
}

const mConnections = new Map();

export async function initAsBackend() {
  const manifest = browser.runtime.getManifest();
  registerAddon(manifest.applications.gecko.id, {
    id:         manifest.applications.gecko.id,
    internalId: browser.runtime.getURL('').replace(/^moz-extension:\/\/([^\/]+)\/.*$/, '$1'),
    icons:      manifest.icons,
    listeningTypes: []
  });
  mContext = kCONTEXT_BACKEND;
  browser.runtime.onConnectExternal.addListener(port => {
    const sender = port.sender;
    mConnections.set(sender.id, port);
    port.onDisconnect.addListener(_message => {
      mConnections.delete(sender.id);
      onMessageExternal({
        type: kUNREGISTER_SELF,
        sender
      }).catch(ApiTabs.createErrorSuppressor());
    });
  });
  const respondedAddons = [];
  const notifiedAddons = {};
  const notifyAddons = configs.knownExternalAddons.concat(configs.cachedExternalAddons);
  log('initAsBackend: notifyAddons = ', respondedAddons);
  await Promise.all(notifyAddons.map(async id => {
    if (id in notifiedAddons)
      return;
    notifiedAddons[id] = true;
    try {
      id = await new Promise((resolve, reject) => {
        browser.runtime.sendMessage(id, {
          type: kNOTIFY_READY
        }).then(() => resolve(id)).catch(ApiTabs.createErrorHandler(reject));
        setTimeout(() => {
          reject(new Error(`TSTAPI.initAsBackend: addon ${id} does not respond.`));
        }, 3000);
      });
      if (id)
        respondedAddons.push(id);
    }
    catch(e) {
      console.log(e);
    }
  }));
  log('initAsBackend: respondedAddons = ', respondedAddons);
  configs.cachedExternalAddons = respondedAddons;
}

browser.runtime.onMessage.addListener((message, _sender) => {
  if (!message ||
      typeof message.type != 'string')
    return;

  switch (mContext) {
    case kCONTEXT_BACKEND:
      switch (message.type) {
        case kCOMMAND_REQUEST_INITIALIZE:
          return Promise.resolve({
            addons:         exportAddons(),
            scrollLocked:   mScrollLockedBy,
            groupingLocked: mGroupingBlockedBy
          });

        case kCOMMAND_REQUEST_CONTROL_STATE:
          return Promise.resolve({
            scrollLocked:   mScrollLockedBy,
            groupingLocked: mGroupingBlockedBy
          });
      }
      break;

    case kCONTEXT_FRONTEND:
      switch (message.type) {
        case kCOMMAND_BROADCAST_API_REGISTERED:
          registerAddon(message.sender.id, message.message);
          if (message.message.style)
            installStyleForAddon(message.sender.id, message.message.style);
          break;

        case kCOMMAND_BROADCAST_API_UNREGISTERED:
          uninstallStyleForAddon(message.sender.id)
          unregisterAddon(message.sender.id);
          break;
      }
      break;

    default:
      return;
  }
});

const mPromisedOnBeforeUnload = new Promise((resolve, _reject) => {
  // If this promise doesn't do anything then there seems to be a timeout so it only works if TST is disabled within about 10 seconds after this promise is used as a response to a message. After that it will not throw an error for the waiting extension.
  // If we use the following then the returned promise will be rejected when TST is disabled even for longer times:
  window.addEventListener('beforeunload', () => resolve());
});

function onMessageExternal(message, sender) {
  if (!message ||
      typeof message.type != 'string')
    return;

  switch (mContext) {
    case kCONTEXT_BACKEND:
      log('backend API message ', message, sender);
      switch (message.type) {
        case kPING:
          return Promise.resolve(true);

        case kREGISTER_SELF:
          return (async () => {
            message.internalId = sender.url.replace(/^moz-extension:\/\/([^\/]+)\/.*$/, '$1');
            message.id = sender.id;
            registerAddon(sender.id, message);
            browser.runtime.sendMessage({
              type:    kCOMMAND_BROADCAST_API_REGISTERED,
              sender:  sender,
              message: message
            }).catch(ApiTabs.createErrorSuppressor());
            const index = configs.cachedExternalAddons.indexOf(sender.id);
            if (index < 0)
              configs.cachedExternalAddons = configs.cachedExternalAddons.concat([sender.id]);
            return true;
          })();

        case kUNREGISTER_SELF:
          return (async () => {
            browser.runtime.sendMessage({
              type: kCOMMAND_BROADCAST_API_UNREGISTERED,
              sender
            }).catch(ApiTabs.createErrorSuppressor());
            unregisterAddon(sender.id);
            delete mScrollLockedBy[sender.id];
            configs.cachedExternalAddons = configs.cachedExternalAddons.filter(id => id != sender.id);
            return true;
          })();

        case kWAIT_FOR_SHUTDOWN:
          return mPromisedOnBeforeUnload;
      }
      break;

    case kCONTEXT_FRONTEND:
      log('frontend API message ', message, sender);
      break;

    default:
      return;
  }

  switch (message.type) {
    case kSCROLL_LOCK:
      mScrollLockedBy[sender.id] = true;
      return Promise.resolve(true);

    case kSCROLL_UNLOCK:
      delete mScrollLockedBy[sender.id];
      return Promise.resolve(true);

    case kBLOCK_GROUPING:
      mGroupingBlockedBy[sender.id] = true;
      return Promise.resolve(true);

    case kUNBLOCK_GROUPING:
      delete mGroupingBlockedBy[sender.id];
      return Promise.resolve(true);
  }
}
browser.runtime.onMessageExternal.addListener(onMessageExternal);

function exportAddons() {
  const exported = {};
  for (const [id, addon] of getAddons()) {
    exported[id] = addon;
  }
  return exported;
}

export async function initAsFrontend() {
  let response;
  while (true) {
    response = await browser.runtime.sendMessage({ type: kCOMMAND_REQUEST_INITIALIZE });
    if (response)
      break;
    await wait(10);
  }
  importAddons(response.addons);
  for (const [id, addon] of getAddons()) {
    if (addon.style)
      installStyleForAddon(id, addon.style);
  }
  mContext = kCONTEXT_FRONTEND;
  mScrollLockedBy    = response.scrollLocked;
  mGroupingBlockedBy = response.groupingLocked;
}

function importAddons(addons) {
  if (!addons)
    console.log(new Error('null import'));
  for (const id of Object.keys(mAddons)) {
    unregisterAddon(id);
  }
  for (const [id, addon] of Object.entries(addons)) {
    registerAddon(id, addon);
  }
}

const mAddonStyles = new Map();

function installStyleForAddon(id, style) {
  let styleElement = mAddonStyles.get(id);
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.setAttribute('type', 'text/css');
    document.head.insertBefore(styleElement, document.querySelector('#addons-style-rules'));
    mAddonStyles.set(id, styleElement);
  }
  styleElement.textContent = style;
}

function uninstallStyleForAddon(id) {
  const styleElement = mAddonStyles.get(id);
  if (!styleElement)
    return;
  document.head.removeChild(styleElement);
  mAddonStyles.delete(id);
}


export function isScrollLocked() {
  return Object.keys(mScrollLockedBy).length > 0;
}

export async function notifyScrolled(params = {}) {
  const lockers = Object.keys(mScrollLockedBy);
  const tab     = params.tab;
  const window  = TabsStore.getWindow();
  const results = await sendMessage({
    type: kNOTIFY_SCROLLED,
    tab:  tab && serializeTab(tab),
    tabs: Tab.getTabs(window).map(serializeTab),
    window,
    windowId: window,

    deltaY:       params.event.deltaY,
    deltaMode:    params.event.deltaMode,
    scrollTop:    params.scrollContainer.scrollTop,
    scrollTopMax: params.scrollContainer.scrollTopMax,

    altKey:   params.event.altKey,
    ctrlKey:  params.event.ctrlKey,
    metaKey:  params.event.metaKey,
    shiftKey: params.event.shiftKey,

    clientX:  params.event.clientX,
    clientY:  params.event.clientY
  }, {
    targets: lockers
  });
  for (const result of results) {
    if (!result || result.error || result.result === undefined)
      delete mScrollLockedBy[result.id];
  }
}


export function isGroupingBlocked() {
  return Object.keys(mGroupingBlockedBy).length > 0;
}


export function serializeTab(tab) {
  tab = Tab.get(tab.id);
  const serialized = serializeTabInternal(tab);
  serialized.children = tab.$TST.children.map(serializeTab);
  return serialized;
}

export async function serializeTabAsync(tab, interval) {
  tab = Tab.get(tab.id);
  const serialized = serializeTabInternal(tab);
  serialized.children = await doProgressively(
    tab.$TST.children,
    tab => serializeTabAsync(tab, interval),
    interval
  );
  return serialized;
}

function serializeTabInternal(tab) {
  tab = Tab.get(tab.id);
  const ancestorTabIds = tab.$TST.ancestors.map(tab => tab.id);
  const serialized     = Object.assign({}, tab.$TST.sanitized, {
    states:   Array.from(tab.$TST.states).filter(state => !Constants.kTAB_INTERNAL_STATES.includes(state)),
    indent:   parseInt(tab.$TST.getAttribute(Constants.kLEVEL) || 0),
    ancestorTabIds
  });
  // console.log(serialized, new Error().stack);
  return serialized;
}

export async function serializeTabWithEffectiveFavIconUrl(tab, interval) {
  const serializedRoot = await serializeTabAsync(tab, interval);
  const promises = [];
  const preparePromiseForEffectiveFavIcon = serializedOneTab => {
    promises.push(TabFavIconHelper.getLastEffectiveFavIconURL(serializedOneTab).then(url => {
      serializedOneTab.effectiveFavIconUrl = url;
    }));
    serializedOneTab.children.map(preparePromiseForEffectiveFavIcon);
  };
  preparePromiseForEffectiveFavIcon(serializedRoot);
  await Promise.all(promises);
  return serializedRoot;
}

export function getListenersForMessageType(type) {
  const uniqueTargets = {};
  for (const [id, addon] of getAddons()) {
    if (addon.listeningTypes.includes(type))
      uniqueTargets[id] = true;
  }
  return Object.keys(uniqueTargets).map(id => getAddon(id));
}

export async function sendMessage(message, options = {}) {
  const uniqueTargets = new Set();
  const listenerAddons = getListenersForMessageType(message.type);
  for (const addon of listenerAddons) {
    uniqueTargets.add(addon.id);
  }
  log(`sendMessage: sending message for ${message.type}: `, {
    message,
    listenerAddons,
    targets: options.targets
  });
  if (options.targets) {
    if (!Array.isArray(options.targets))
      options.targets = [options.targets];
    for (const id of options.targets) {
      uniqueTargets.add(id);
    }
  }

  const promisedResults = spawnMessages(uniqueTargets, message);
  return Promise.all(promisedResults).then(results => {
    log(`sendMessage: got responses for ${message.type}: `, results);
    return results;
  }).catch(ApiTabs.createErrorHandler());
}

function* spawnMessages(targetSet, message) {
  const send = async (id) => {
    try {
      const result = await browser.runtime.sendMessage(id, message).catch(ApiTabs.createErrorHandler());
      return {
        id,
        result
      };
    }
    catch(e) {
      return {
        id,
        error: e
      };
    }
  };

  for (const id of targetSet) {
    yield send(id);
  }
}


export async function getTargetTabs(message, sender) {
  await Tab.waitUntilTrackedAll(message.window || message.windowId);
  if (Array.isArray(message.tabs))
    return getTabsFromWrongIds(message.tabs, sender);
  if (Array.isArray(message.tabIds))
    return getTabsFromWrongIds(message.tabIds, sender);
  if (message.window || message.windowId) {
    if (message.tab == '*' ||
        message.tabId == '*' ||
        message.tabs == '*' ||
        message.tabIds == '*')
      return Tab.getAllTabs(message.window || message.windowId, { iterator: true });
    else
      return Tab.getRoots(message.window || message.windowId, { iterator: true });
  }
  if (message.tab == '*' ||
      message.tabId == '*' ||
      message.tabs == '*' ||
      message.tabIds == '*') {
    const window = await browser.windows.getLastFocused({
      windowTypes: ['normal']
    }).catch(ApiTabs.createErrorHandler());
    return Tab.getAllTabs(window.id, { iterator: true });
  }
  if (message.tab || message.tabId)
    return getTabsFromWrongIds([message.tab || message.tabId], sender);
  return [];
}

async function getTabsFromWrongIds(ids, sender) {
  log('getTabsFromWrongIds ', ids, sender);
  let activeWindow = [];
  if (ids.some(id => typeof id != 'number')) {
    const window = await browser.windows.getLastFocused({
      populate: true
    }).catch(ApiTabs.createErrorHandler());
    activeWindow = TabsStore.windows.get(window.id);
  }
  const tabs = await Promise.all(ids.map(async (id) => {
    if (id && typeof id == 'object' && typeof id.id == 'number') // tabs.Tab
      id = id.id;
    switch (String(id).toLowerCase()) {
      case 'active':
      case 'current':
        return Tab.getActiveTab(activeWindow.id);
      case 'next':
        return Tab.getActiveTab(activeWindow.id).$TST.nextTab;
      case 'previous':
      case 'prev':
        return Tab.getActiveTab(activeWindow.id).$TST.previousTab;
      case 'nextsibling':
        return Tab.getActiveTab(activeWindow.id).$TST.nextSiblingTab;
      case 'previoussibling':
      case 'prevsibling':
        return Tab.getActiveTab(activeWindow.id).$TST.previousSiblingTab;
      case 'sendertab':
        return sender.tab || null;
      case 'highlighted':
      case 'multiselected':
        return Tab.getHighlightedTabs(activeWindow.id);
      default:
        return Tab.get(id) || Tab.getByUniqueId(id);
    }
  }));
  log('=> ', tabs);

  return tabs.flat().filter(tab => !!tab);
}

export async function doProgressively(tabs, task, interval) {
  interval = Math.max(0, interval);
  let lastStartAt = Date.now();
  const results = [];
  for (const tab of tabs) {
    results.push(task(tab));
    if (interval && (Date.now() - lastStartAt >= interval)) {
      await wait(50);
      lastStartAt = Date.now();
    }
  }
  return Promise.all(results);
}

export function formatResult(results, originalMessage) {
  if (Array.isArray(originalMessage.tabs))
    return results;
  if (originalMessage.tab == '*' ||
      originalMessage.tabs == '*')
    return results;
  if (originalMessage.tab)
    return results[0];
  return results;
}

Sidebar.onConnected.addListener(windowId => {
  sendMessage({
    type:   kNOTIFY_SIDEBAR_SHOW,
    window: windowId,
    windowId
  });
});

Sidebar.onDisconnected.addListener(windowId => {
  sendMessage({
    type:   kNOTIFY_SIDEBAR_HIDE,
    window: windowId,
    windowId
  });
});
