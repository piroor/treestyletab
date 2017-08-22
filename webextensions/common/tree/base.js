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
 * Portions created by the Initial Developer are Copyright (C) 2011-2017
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

var kCOMMAND_REQUEST_TREE_INFO = 'treestyletab:request-tree-info';
var kCOMMAND_APPLY_TREE_STRUCTURE = 'treestyletab:apply-tree-structure';

var kPARENT   = 'data-parent-id';
var kCHILDREN = 'data-child-ids';
var kANCESTORS = 'data-ancestor-ids';
var kNEST     = 'data-nest';
var kINSERT_BEFORE = 'data-insert-before-id';
var kINSERT_AFTER  = 'data-insert-after-id';
var kCLOSED_SET_ID = 'data-closed-set-id';

var kCOLLAPSED_DONE   = 'collapsed-completely';
var kCOLLAPSING_PHASE = 'data-collapsing-phase';
var kCOLLAPSING_PHASE_TO_BE_COLLAPSED = 'collapse';
var kCOLLAPSING_PHASE_TO_BE_EXPANDED  = 'expand';

var kFAVICON  = 'favicon';
var kTHROBBER = 'throbber';
var kTWISTY   = 'twisty';
var kCOUNTER  = 'counter';


var gAllTabs;
var gInternalMovingCount = 0;
var gIsBackground = false;
var gTargetWindow = null;
var gRestoringTree = false;
var gOpeningCount = 0;

function buildTab(aTab) {
  var item = document.createElement('li');
  item.apiTab = aTab;
  item.setAttribute('id', `tab-${aTab.windowId}-${aTab.id}`);
  item.setAttribute(kCHILDREN, '|');
  item.appendChild(document.createTextNode(aTab.title));
  item.setAttribute('title', aTab.title);
  item.classList.add('tab');
  if (aTab.active)
    item.classList.add('active');
  return item;
}

function buildTabsContainerFor(aWindowId) {
  var container = document.createElement('ul');
  container.windowId = aWindowId;
  container.setAttribute('id', `window-${aWindowId}`);
  container.classList.add('tabs');
  return container;
}

function clearAllTabsContainers() {
  var range = document.createRange();
  range.selectNodeContents(gAllTabs);
  range.deleteContents();
  range.detach();
}

function canAnimate() {
  return !gIsBackground && configs.animation;
}



var NSResolver = {
  lookupNamespaceURI : function(aPrefix) {
    switch (aPrefix)
    {
      case 'html':
      case 'xhtml':
        return 'http://www.w3.org/1999/xhtml';
      case 'xlink':
        return 'http://www.w3.org/1999/xlink';
      default:
        return '';
    }
  }
};

function evaluateXPath(aExpression, aContext, aType) {
  if (!aType)
    aType = XPathResult.ORDERED_NODE_SNAPSHOT_TYPE;
  try {
    var result = (aContext.ownerDocument || aContext).evaluate(
        aExpression,
        (aContext || document),
        NSResolver,
        aType,
        null
      );
  }
  catch(e) {
    return {
      singleNodeValue: null,
      snapshotLength:  0,
      snapshotItem:    function() {
        return null
      }
    };
  }
  return result;
},

function getArrayFromXPathResult(aXPathResult) {
  var max = aXPathResult.snapshotLength;
  var array = new Array(max);
  if (!max)
    return array;

  for (var i = 0; i < max; i++) {
    array[i] = aXPathResult.snapshotItem(i);
  }
  return array;
}
