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
  wait,
  configs
} from './common.js';
import * as Constants from './constants.js';
import * as Tabs from './tabs.js';

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

export const kCOMMAND_BROADCAST_API_REGISTERED   = 'treestyletab:broadcast-registered';
export const kCOMMAND_BROADCAST_API_UNREGISTERED = 'treestyletab:broadcast-unregistered';
export const kCOMMAND_REQUEST_REGISTERED_ADDONS  = 'treestyletab:request-registered-addons';
export const kCOMMAND_REQUEST_CONTROL_STATE      = 'treestyletab:request-control-state';

const kCONTEXT_BACKEND  = 1;
const kCONTEXT_FRONTEND = 2;

let gContext = null;
const gAddons = new Map();
let gScrollLockedBy    = {};
let gGroupingBlockedBy = {};

export function getAddon(aId) {
  return gAddons.get(aId);
}

export function registerAddon(aId, aAddon) {
  gAddons.set(aId, aAddon);
}

export function unregisterAddon(aId) {
  gAddons.delete(aId);
  delete gScrollLockedBy[aId];
  delete gGroupingBlockedBy[aId];
}

export function getAddons() {
  return gAddons.entries();
}

export function isInitialized() {
  return !!gContext;
}

export async function initAsBackend() {
  const manifest = browser.runtime.getManifest();
  registerAddon(manifest.applications.gecko.id, {
    id:         manifest.applications.gecko.id,
    internalId: browser.runtime.getURL('').replace(/^moz-extension:\/\/([^\/]+)\/.*$/, '$1'),
    icons:      manifest.icons,
    listeningTypes: []
  });
  gContext = kCONTEXT_BACKEND;
  const respondedAddons = [];
  const notifiedAddons = {};
  const notifyAddons = configs.knownExternalAddons.concat(configs.cachedExternalAddons);
  await Promise.all(notifyAddons.map(async aId => {
    if (aId in notifiedAddons)
      return;
    notifiedAddons[aId] = true;
    try {
      const success = await browser.runtime.sendMessage(aId, {
        type: kNOTIFY_READY
      });
      if (success)
        respondedAddons.push(aId);
    }
    catch(_e) {
    }
  }));
  configs.cachedExternalAddons = respondedAddons;
}

browser.runtime.onMessage.addListener((aMessage, _aSender) => {
  if (!aMessage ||
      typeof aMessage.type != 'string')
    return;

  switch (gContext) {
    case kCONTEXT_BACKEND:
      switch (aMessage.type) {
        case kCOMMAND_REQUEST_REGISTERED_ADDONS:
          return Promise.resolve(exportAddons());

        case kCOMMAND_REQUEST_CONTROL_STATE:
          return Promise.resolve({
            scrollLocked:   gScrollLockedBy,
            groupingLocked: gGroupingBlockedBy
          });
      }
      break;

    case kCONTEXT_FRONTEND:
      switch (aMessage.type) {
        case kCOMMAND_BROADCAST_API_REGISTERED:
          registerAddon(aMessage.sender.id, aMessage.message);
          if (aMessage.message.style)
            installStyleForAddon(aMessage.sender.id, aMessage.message.style);
          break;

        case kCOMMAND_BROADCAST_API_UNREGISTERED:
          uninstallStyleForAddon(aMessage.sender.id)
          unregisterAddon(aMessage.sender.id);
          break;
      }
      break;

    default:
      return;
  }
});

browser.runtime.onMessageExternal.addListener((aMessage, aSender) => {
  if (!aMessage ||
      typeof aMessage.type != 'string')
    return;

  switch (gContext) {
    case kCONTEXT_BACKEND:
      switch (aMessage.type) {
        case kPING:
          return Promise.resolve(true);

        case kREGISTER_SELF:
          return (async () => {
            if (!aMessage.listeningTypes) {
              // for backward compatibility, send all message types available on TST 2.4.16 by default.
              aMessage.listeningTypes = [
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
            aMessage.internalId = aSender.url.replace(/^moz-extension:\/\/([^\/]+)\/.*$/, '$1');
            aMessage.id = aSender.id;
            registerAddon(aSender.id, aMessage);
            browser.runtime.sendMessage({
              type:    kCOMMAND_BROADCAST_API_REGISTERED,
              sender:  aSender,
              message: aMessage
            });
            const index = configs.cachedExternalAddons.indexOf(aSender.id);
            if (index < 0)
              configs.cachedExternalAddons = configs.cachedExternalAddons.concat([aSender.id]);
            return true;
          })();

        case kUNREGISTER_SELF:
          return (async () => {
            browser.runtime.sendMessage({
              type:    kCOMMAND_BROADCAST_API_UNREGISTERED,
              sender:  aSender,
              message: aMessage
            });
            unregisterAddon(aSender.id);
            delete gScrollLockedBy[aSender.id];
            configs.cachedExternalAddons = configs.cachedExternalAddons.filter(aId => aId != aSender.id);
            return true;
          })();
      }
      break;

    case kCONTEXT_FRONTEND:
      break;

    default:
      return;
  }

  switch (aMessage.type) {
    case kSCROLL_LOCK:
      gScrollLockedBy[aSender.id] = true;
      return Promise.resolve(true);

    case kSCROLL_UNLOCK:
      delete gScrollLockedBy[aSender.id];
      return Promise.resolve(true);

    case kBLOCK_GROUPING:
      gGroupingBlockedBy[aSender.id] = true;
      return Promise.resolve(true);

    case kUNBLOCK_GROUPING:
      delete gGroupingBlockedBy[aSender.id];
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
  gContext = kCONTEXT_FRONTEND;
  const state = await browser.runtime.sendMessage({ type: kCOMMAND_REQUEST_CONTROL_STATE });
  gScrollLockedBy    = state.scrollLocked;
  gGroupingBlockedBy = state.groupingLocked;
}

function importAddons(aAddons) {
  if (!aAddons)
    console.log(new Error('null import'));
  for (const id of Object.keys(gAddons)) {
    unregisterAddon(id);
  }
  for (const [id, addon] of Object.entries(aAddons)) {
    registerAddon(id, addon);
  }
}

const gAddonStyles = new Map();

function installStyleForAddon(aId, aStyle) {
  let styleElement = gAddonStyles.get(aId);
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.setAttribute('type', 'text/css');
    document.head.insertBefore(styleElement, document.querySelector('#addons-style-rules'));
    gAddonStyles.set(aId, styleElement);
  }
  styleElement.textContent = aStyle;
}

function uninstallStyleForAddon(aId) {
  const styleElement = gAddonStyles.get(aId);
  if (!styleElement)
    return;
  document.head.removeChild(styleElement);
  gAddonStyles.delete(aId);
}


export function isScrollLocked() {
  return Object.keys(gScrollLockedBy).length > 0;
}

export async function notifyScrolled(aParams = {}) {
  const lockers = Object.keys(gScrollLockedBy);
  const tab     = aParams.tab;
  const window  = Tabs.getWindow();
  const results = await sendMessage({
    type: kNOTIFY_SCROLLED,
    tab:  tab && serializeTab(tab),
    tabs: Tabs.getTabs(window).map(serializeTab),
    window,

    deltaY:       aParams.event.deltaY,
    deltaMode:    aParams.event.deltaMode,
    scrollTop:    aParams.scrollContainer.scrollTop,
    scrollTopMax: aParams.scrollContainer.scrollTopMax,

    altKey:   aParams.event.altKey,
    ctrlKey:  aParams.event.ctrlKey,
    metaKey:  aParams.event.metaKey,
    shiftKey: aParams.event.shiftKey,

    clientX:  aParams.event.clientX,
    clientY:  aParams.event.clientY
  }, {
    targets: lockers
  });
  for (const result of results) {
    if (result.error || result.result === undefined)
      delete gScrollLockedBy[result.id];
  }
}


export function isGroupingBlocked() {
  return Object.keys(gGroupingBlockedBy).length > 0;
}


export function serializeTab(aTab) {
  const effectiveFavIcon = TabFavIconHelper.effectiveFavIcons.get(aTab.apiTab.id);
  const children         = Tabs.getChildTabs(aTab).map(serializeTab);
  const ancestorTabIds   = Tabs.getAncestorTabs(aTab).map(aTab => aTab.apiTab.id);
  return Object.assign({}, aTab.apiTab, {
    states:   Array.slice(aTab.classList).filter(aState => !Constants.kTAB_INTERNAL_STATES.includes(aState)),
    indent:   parseInt(aTab.getAttribute(Constants.kLEVEL) || 0),
    effectiveFavIconUrl: effectiveFavIcon && effectiveFavIcon.favIconUrl,
    children, ancestorTabIds
  });
}

export function getListenersForMessageType(aType) {
  const uniqueTargets = {};
  for (const [id, addon] of getAddons()) {
    if (addon.listeningTypes.includes(aType))
      uniqueTargets[id] = true;
  }
  return Object.keys(uniqueTargets).map(aId => getAddon(aId));
}

export async function sendMessage(aMessage, aOptions = {}) {
  const uniqueTargets = {};
  for (const addon of getListenersForMessageType(aMessage.type)) {
    uniqueTargets[addon.id] = true;
  }
  if (aOptions.targets) {
    if (!Array.isArray(aOptions.targets))
      aOptions.targets = [aOptions.targets];
    for (const id of aOptions.targets) {
      uniqueTargets[id] = true;
    }
  }
  return Promise.all(Object.keys(uniqueTargets).map(async (aId) => {
    try {
      const result = await browser.runtime.sendMessage(aId, aMessage);
      return {
        id:     aId,
        result: result
      };
    }
    catch(e) {
      return {
        id:    aId,
        error: e
      };
    }
  }));
}


export async function getTargetTabs(aMessage, aSender) {
  await Tabs.waitUntilAllTabsAreCreated();
  if (Array.isArray(aMessage.tabs))
    return getTabsFromWrongIds(aMessage.tabs, aSender);
  if (aMessage.window || aMessage.windowId) {
    if (aMessage.tab == '*' ||
        aMessage.tabs == '*')
      return Tabs.getAllTabs(aMessage.window || aMessage.windowId);
    else
      return Tabs.getRootTabs(aMessage.window || aMessage.windowId);
  }
  if (aMessage.tab == '*' ||
      aMessage.tabs == '*') {
    const window = await browser.windows.getLastFocused({
      windowTypes: ['normal']
    });
    return Tabs.getAllTabs(window.id);
  }
  if (aMessage.tab)
    return getTabsFromWrongIds([aMessage.tab], aSender);
  return [];
}

async function getTabsFromWrongIds(aIds, aSender) {
  let tabsInActiveWindow = [];
  if (aIds.some(aId => typeof aId != 'number')) {
    const window = await browser.windows.getLastFocused({
      populate:    true,
      windowTypes: ['normal']
    });
    tabsInActiveWindow = window.tabs;
  }
  const tabOrAPITabOrIds = await Promise.all(aIds.map(async (aId) => {
    switch (String(aId).toLowerCase()) {
      case 'active':
      case 'current': {
        const tabs = tabsInActiveWindow.filter(aTab => aTab.active);
        return TabIdFixer.fixTab(tabs[0]);
      }
      case 'next': {
        const tabs = tabsInActiveWindow.filter((aTab, aIndex) =>
          aIndex > 0 && tabsInActiveWindow[aIndex - 1].active);
        return tabs.length > 0 ? TabIdFixer.fixTab(tabs[0]) : null ;
      }
      case 'previous':
      case 'prev': {
        const maxIndex = tabsInActiveWindow.length - 1;
        const tabs = tabsInActiveWindow.filter((aTab, aIndex) =>
          aIndex < maxIndex && tabsInActiveWindow[aIndex + 1].active);
        return tabs.length > 0 ? TabIdFixer.fixTab(tabs[0]) : null ;
      }
      case 'nextsibling': {
        const tabs = tabsInActiveWindow.filter(aTab => aTab.active);
        return Tabs.getNextSiblingTab(Tabs.getTabById(tabs[0]));
      }
      case 'previoussibling':
      case 'prevsibling': {
        const tabs = tabsInActiveWindow.filter(aTab => aTab.active);
        return Tabs.getPreviousSiblingTab(Tabs.getTabById(tabs[0]));
      }
      case 'sendertab':
        if (aSender.tab)
          return aSender.tab;
      default:
        const tabFromUniqueId = Tabs.getTabByUniqueId(aId);
        return tabFromUniqueId || aId;
    }
  }));
  return tabOrAPITabOrIds.map(Tabs.getTabById).filter(aTab => !!aTab);
}

export function formatResult(aResults, aOriginalMessage) {
  if (Array.isArray(aOriginalMessage.tabs))
    return aResults;
  if (aOriginalMessage.tab == '*' ||
      aOriginalMessage.tabs == '*')
    return aResults;
  if (aOriginalMessage.tab)
    return aResults[0];
  return aResults;
}
