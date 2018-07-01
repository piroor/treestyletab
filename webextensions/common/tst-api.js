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

import TabFavIconHelper from '../extlib/TabFavIconHelper.js';
import TabIdFixer from '../extlib/TabIdFixer.js';

import {
  log as internalLogger,
  wait,
  configs
} from './common.js';
import * as Constants from './constants.js';
import * as Tabs from './tabs.js';

// eslint-disable-next-line no-unused-vars
function log(...args) {
  if (configs.logFor['common/tst-api'])
    internalLogger(...args);
}

export const kREGISTER_SELF         = 'register-self';
export const kUNREGISTER_SELF       = 'unregister-self';
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
export const kNOTIFY_TRY_MOVE_FOCUS_FROM_CLOSING_CURRENT_TAB = 'try-move-focus-from-closing-current-tab';
export const kGET_TREE              = 'get-tree';
export const kATTACH                = 'attach';
export const kDETACH                = 'detach';
export const kINDENT                = 'indent';
export const kDEMOTE                = 'demote';
export const kOUTDENT               = 'outdent';
export const kPROMOTE               = 'promote';
export const kMOVE_UP               = 'move-up';
export const kMOVE_DOWN             = 'move-down';
export const kFOCUS                 = 'focus';
export const kDUPLICATE             = 'duplicate';
export const kGROUP_TABS            = 'group-tabs';
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
export const kCOMMAND_REQUEST_REGISTERED_ADDONS  = 'treestyletab:request-registered-addons';
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
  mAddons.set(id, addon);
}

function unregisterAddon(id) {
  mAddons.delete(id);
  delete mScrollLockedBy[id];
  delete mGroupingBlockedBy[id];
}

function getAddons() {
  return mAddons.entries();
}

export async function initAsBackend() {
  const manifest = browser.runtime.getManifest();
  registerAddon(manifest.applications.gecko.id, {
    id:         manifest.applications.gecko.id,
    internalId: browser.runtime.getURL('').replace(/^moz-extension:\/\/([^\/]+)\/.*$/, '$1'),
    icons:      manifest.icons,
    listeningTypes: []
  });
  mContext = kCONTEXT_BACKEND;
  const respondedAddons = [];
  const notifiedAddons = {};
  const notifyAddons = configs.knownExternalAddons.concat(configs.cachedExternalAddons);
  await Promise.all(notifyAddons.map(async id => {
    if (id in notifiedAddons)
      return;
    notifiedAddons[id] = true;
    try {
      const success = await browser.runtime.sendMessage(id, {
        type: kNOTIFY_READY
      });
      if (success)
        respondedAddons.push(id);
    }
    catch(_e) {
    }
  }));
  configs.cachedExternalAddons = respondedAddons;
}

browser.runtime.onMessage.addListener((message, _aSender) => {
  if (!message ||
      typeof message.type != 'string')
    return;

  switch (mContext) {
    case kCONTEXT_BACKEND:
      switch (message.type) {
        case kCOMMAND_REQUEST_REGISTERED_ADDONS:
          return Promise.resolve(exportAddons());

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

browser.runtime.onMessageExternal.addListener((message, sender) => {
  if (!message ||
      typeof message.type != 'string')
    return;

  switch (mContext) {
    case kCONTEXT_BACKEND:
      switch (message.type) {
        case kPING:
          return Promise.resolve(true);

        case kREGISTER_SELF:
          return (async () => {
            if (!message.listeningTypes) {
              // for backward compatibility, send all message types available on TST 2.4.16 by default.
              message.listeningTypes = [
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
            message.internalId = sender.url.replace(/^moz-extension:\/\/([^\/]+)\/.*$/, '$1');
            message.id = sender.id;
            registerAddon(sender.id, message);
            browser.runtime.sendMessage({
              type:    kCOMMAND_BROADCAST_API_REGISTERED,
              sender:  sender,
              message: message
            });
            const index = configs.cachedExternalAddons.indexOf(sender.id);
            if (index < 0)
              configs.cachedExternalAddons = configs.cachedExternalAddons.concat([sender.id]);
            return true;
          })();

        case kUNREGISTER_SELF:
          return (async () => {
            browser.runtime.sendMessage({
              type:    kCOMMAND_BROADCAST_API_UNREGISTERED,
              sender:  sender,
              message: message
            });
            unregisterAddon(sender.id);
            delete mScrollLockedBy[sender.id];
            configs.cachedExternalAddons = configs.cachedExternalAddons.filter(id => id != sender.id);
            return true;
          })();
      }
      break;

    case kCONTEXT_FRONTEND:
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
});

function exportAddons() {
  const exported = {};
  for (const [id, addon] of getAddons()) {
    exported[id] = addon;
  }
  return exported;
}

export async function initAsFrontend() {
  let addons;
  while (!addons) {
    addons = await browser.runtime.sendMessage({ type: kCOMMAND_REQUEST_REGISTERED_ADDONS });
    await wait(10);
  }
  importAddons(addons);
  for (const [id, addon] of getAddons()) {
    if (addon.style)
      installStyleForAddon(id, addon.style);
  }
  mContext = kCONTEXT_FRONTEND;
  const state = await browser.runtime.sendMessage({ type: kCOMMAND_REQUEST_CONTROL_STATE });
  mScrollLockedBy    = state.scrollLocked;
  mGroupingBlockedBy = state.groupingLocked;
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
  const window  = Tabs.getWindow();
  const results = await sendMessage({
    type: kNOTIFY_SCROLLED,
    tab:  tab && serializeTab(tab),
    tabs: Tabs.getTabs(window).map(serializeTab),
    window,

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
    if (result.error || result.result === undefined)
      delete mScrollLockedBy[result.id];
  }
}


export function isGroupingBlocked() {
  return Object.keys(mGroupingBlockedBy).length > 0;
}


export function serializeTab(tab) {
  const effectiveFavIcon = TabFavIconHelper.effectiveFavIcons.get(tab.apiTab.id);
  const children         = Tabs.getChildTabs(tab).map(serializeTab);
  const ancestorTabIds   = Tabs.getAncestorTabs(tab).map(tab => tab.apiTab.id);
  return Object.assign({}, tab.apiTab, {
    states:   Array.slice(tab.classList).filter(state => !Constants.kTAB_INTERNAL_STATES.includes(state)),
    indent:   parseInt(tab.getAttribute(Constants.kLEVEL) || 0),
    effectiveFavIconUrl: effectiveFavIcon && effectiveFavIcon.favIconUrl,
    children, ancestorTabIds
  });
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
  const uniqueTargets = {};
  for (const addon of getListenersForMessageType(message.type)) {
    uniqueTargets[addon.id] = true;
  }
  if (options.targets) {
    if (!Array.isArray(options.targets))
      options.targets = [options.targets];
    for (const id of options.targets) {
      uniqueTargets[id] = true;
    }
  }
  return Promise.all(Object.keys(uniqueTargets).map(async (id) => {
    try {
      const result = await browser.runtime.sendMessage(id, message);
      return {
        id:     id,
        result: result
      };
    }
    catch(e) {
      return {
        id:    id,
        error: e
      };
    }
  }));
}


export async function getTargetTabs(message, sender) {
  await Tabs.waitUntilAllTabsAreCreated();
  if (Array.isArray(message.tabs))
    return getTabsFromWrongIds(message.tabs, sender);
  if (message.window || message.windowId) {
    if (message.tab == '*' ||
        message.tabs == '*')
      return Tabs.getAllTabs(message.window || message.windowId);
    else
      return Tabs.getRootTabs(message.window || message.windowId);
  }
  if (message.tab == '*' ||
      message.tabs == '*') {
    const window = await browser.windows.getLastFocused({
      windowTypes: ['normal']
    });
    return Tabs.getAllTabs(window.id);
  }
  if (message.tab)
    return getTabsFromWrongIds([message.tab], sender);
  return [];
}

async function getTabsFromWrongIds(aIds, sender) {
  let tabsInActiveWindow = [];
  if (aIds.some(id => typeof id != 'number')) {
    const window = await browser.windows.getLastFocused({
      populate:    true,
      windowTypes: ['normal']
    });
    tabsInActiveWindow = window.tabs;
  }
  const tabOrAPITabOrIds = await Promise.all(aIds.map(async (id) => {
    switch (String(id).toLowerCase()) {
      case 'active':
      case 'current': {
        const tabs = tabsInActiveWindow.filter(tab => tab.active);
        return TabIdFixer.fixTab(tabs[0]);
      }
      case 'next': {
        const tabs = tabsInActiveWindow.filter((tab, index) =>
          index > 0 && tabsInActiveWindow[index - 1].active);
        return tabs.length > 0 ? TabIdFixer.fixTab(tabs[0]) : null ;
      }
      case 'previous':
      case 'prev': {
        const maxIndex = tabsInActiveWindow.length - 1;
        const tabs = tabsInActiveWindow.filter((tab, index) =>
          index < maxIndex && tabsInActiveWindow[index + 1].active);
        return tabs.length > 0 ? TabIdFixer.fixTab(tabs[0]) : null ;
      }
      case 'nextsibling': {
        const tabs = tabsInActiveWindow.filter(tab => tab.active);
        return Tabs.getNextSiblingTab(Tabs.getTabById(tabs[0]));
      }
      case 'previoussibling':
      case 'prevsibling': {
        const tabs = tabsInActiveWindow.filter(tab => tab.active);
        return Tabs.getPreviousSiblingTab(Tabs.getTabById(tabs[0]));
      }
      case 'sendertab':
        if (sender.tab)
          return sender.tab;
      default:
        const tabFromUniqueId = Tabs.getTabByUniqueId(id);
        return tabFromUniqueId || id;
    }
  }));
  return tabOrAPITabOrIds.map(Tabs.getTabById).filter(tab => !!tab);
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
