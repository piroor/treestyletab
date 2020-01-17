/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  configs
} from '/common/common.js';

import * as Constants from '/common/constants.js';
import * as ApiTabs from '/common/api-tabs.js';

function log(...args) {
  internalLogger('background/browser-action-menu', ...args);
}

const delimiter = browser.i18n.getMessage('config_terms_delimiter');

function indent(level = 1) {
  let result = '';
  for (let i = 0, maxi = level; i < maxi; i++) {
    result += '   ';
  }
  return result;
}

const mItems = [
  {
    title:    browser.i18n.getMessage('config_appearance_caption'),
    children: [
      {
        title:    browser.i18n.getMessage('config_sidebarPosition_caption'),
        children: [
          {
            title: browser.i18n.getMessage('config_sidebarPosition_left'),
            key:   'sidebarPosition',
            value: Constants.kTABBAR_POSITION_LEFT,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_sidebarPosition_right'),
            key:   'sidebarPosition',
            value: Constants.kTABBAR_POSITION_RIGHT,
            type:  'radio'
          }
        ]
      },
      {
        title:    browser.i18n.getMessage('config_sidebarDirection_caption'),
        children: [
          {
            title: browser.i18n.getMessage('config_sidebarDirection_ltr'),
            key:   'sidebarDirection',
            value: Constants.kTABBAR_DIRECTION_LTR,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_sidebarDirection_rtl'),
            key:   'sidebarDirection',
            value: Constants.kTABBAR_DIRECTION_RTL,
            type:  'radio'
          }
        ]
      },
      {
        title:    browser.i18n.getMessage('config_style_caption'),
        children: [
          {
            title: browser.i18n.getMessage('config_style_plain'),
            key:   'style',
            value: 'plain',
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_style_plain_dark'),
            key:   'style',
            value: 'plain-dark',
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_style_vertigo'),
            key:   'style',
            value: 'vertigo',
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_style_mixed'),
            key:   'style',
            value: 'mixed',
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_style_metal'),
            key:   'style',
            value: 'metal',
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_style_sidebar'),
            key:   'style',
            value: 'sidebar',
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_style_highcontrast'),
            key:   'style',
            value: 'highcontrast',
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_style_none'),
            key:   'style',
            value: 'none',
            type:  'radio'
          }
        ]
      },
      {
        title: browser.i18n.getMessage('config_applyBrowserTheme_label'),
        key:   'applyBrowserTheme',
        type:  'checkbox',
        expert: true
      },
      {
        title: browser.i18n.getMessage('config_animation_label'),
        key:   'animation',
        type:  'checkbox'
      },
      {
        title:    browser.i18n.getMessage('config_labelOverflowStyle_caption'),
        children: [
          {
            title: browser.i18n.getMessage('config_labelOverflowStyle_fade'),
            key:   'labelOverflowStyle',
            value: 'fade',
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_labelOverflowStyle_crop'),
            key:   'labelOverflowStyle',
            value: 'crop',
            type:  'radio'
          }
        ],
        expert: true
      },
      {
        title: browser.i18n.getMessage('config_faviconizePinnedTabs_label'),
        key:   'faviconizePinnedTabs',
        type:  'checkbox',
        expert: true
      },
      {
        title: browser.i18n.getMessage('config_showCollapsedDescendantsByTooltip_label'),
        key:   'showCollapsedDescendantsByTooltip',
        type:  'checkbox',
        expert: true
      },
      {
        title: browser.i18n.getMessage('config_applyThemeColorToIcon_label'),
        key:   'applyThemeColorToIcon',
        type:  'checkbox',
        expert: true
      }
    ]
  },
  {
    title:    browser.i18n.getMessage('config_context_caption'),
    children: [
      {
        title: browser.i18n.getMessage('config_extraItems_tabs_topLevel'),
        enabled: false
      },
      {
        title: indent() + browser.i18n.getMessage('context_reloadTree_label'),
        key:   'context_topLevel_reloadTree',
        type:  'checkbox'
      },
      {
        title: indent() + browser.i18n.getMessage('context_reloadDescendants_label'),
        key:   'context_topLevel_reloadDescendants',
        type:  'checkbox'
      },
      {
        title: indent() + browser.i18n.getMessage('context_closeTree_label'),
        key:   'context_topLevel_closeTree',
        type:  'checkbox'
      },
      {
        title: indent() + browser.i18n.getMessage('context_closeDescendants_label'),
        key:   'context_topLevel_closeDescendants',
        type:  'checkbox'
      },
      {
        title: indent() + browser.i18n.getMessage('context_closeOthers_label'),
        key:   'context_topLevel_closeOthers',
        type:  'checkbox'
      },
      {
        title: indent() + browser.i18n.getMessage('context_collapseTree_label'),
        key:   'context_topLevel_collapseTree',
        type:  'checkbox'
      },
      {
        title: indent() + browser.i18n.getMessage('context_collapseAll_label'),
        key:   'context_topLevel_collapseAll',
        type:  'checkbox'
      },
      {
        title: indent() + browser.i18n.getMessage('context_expandTree_label'),
        key:   'context_topLevel_expandTree',
        type:  'checkbox'
      },
      {
        title: indent() + browser.i18n.getMessage('context_expandAll_label'),
        key:   'context_topLevel_expandAll',
        type:  'checkbox'
      },
      {
        title: indent() + browser.i18n.getMessage('context_lockCollapsed_label'),
        key:   'context_topLevel_lockCollapsed',
        type:  'checkbox'
      },
      {
        title: indent() + browser.i18n.getMessage('context_bookmarkTree_label'),
        key:   'context_topLevel_bookmarkTree',
        type:  'checkbox'
      },
      {
        title: indent() + browser.i18n.getMessage('context_groupTabs_label'),
        key:   'context_topLevel_groupTabs',
        type:  'checkbox'
      },
      { type: 'separator' },
      {
        title: browser.i18n.getMessage('config_extraItems_tabs_subMenu'),
        enabled: false
      },
      {
        title: indent() + browser.i18n.getMessage('context_reloadTree_label'),
        key:   'context_reloadTree',
        type:  'checkbox'
      },
      {
        title: indent() + browser.i18n.getMessage('context_reloadDescendants_label'),
        key:   'context_reloadDescendants',
        type:  'checkbox'
      },
      {
        title: indent() + browser.i18n.getMessage('context_closeTree_label'),
        key:   'context_closeTree',
        type:  'checkbox'
      },
      {
        title: indent() + browser.i18n.getMessage('context_closeDescendants_label'),
        key:   'context_closeDescendants',
        type:  'checkbox'
      },
      {
        title: indent() + browser.i18n.getMessage('context_closeOthers_label'),
        key:   'context_closeOthers',
        type:  'checkbox'
      },
      {
        title: indent() + browser.i18n.getMessage('context_collapseTree_label'),
        key:   'context_collapseTree',
        type:  'checkbox'
      },
      {
        title: indent() + browser.i18n.getMessage('context_collapseAll_label'),
        key:   'context_collapseAll',
        type:  'checkbox'
      },
      {
        title: indent() + browser.i18n.getMessage('context_expandTree_label'),
        key:   'context_expandTree',
        type:  'checkbox'
      },
      {
        title: indent() + browser.i18n.getMessage('context_expandAll_label'),
        key:   'context_expandAll',
        type:  'checkbox'
      },
      {
        title: indent() + browser.i18n.getMessage('context_lockCollapsed_label'),
        key:   'context_lockCollapsed',
        type:  'checkbox'
      },
      {
        title: indent() + browser.i18n.getMessage('context_bookmarkTree_label'),
        key:   'context_bookmarkTree',
        type:  'checkbox'
      },
      {
        title: indent() + browser.i18n.getMessage('context_groupTabs_label'),
        key:   'context_groupTabs',
        type:  'checkbox'
      },
      { type: 'separator' },
      {
        title: browser.i18n.getMessage('config_extraItems_bookmarks_caption'),
        enabled: false
      },
      {
        title: indent() + browser.i18n.getMessage('context_openAllBookmarksWithStructure_label'),
        key:   'context_openAllBookmarksWithStructure',
        type:  'checkbox'
      },
      {
        title: indent() + browser.i18n.getMessage('context_openAllBookmarksWithStructureRecursively_label'),
        key:   'context_openAllBookmarksWithStructureRecursively',
        type:  'checkbox'
      },
      { type: 'separator' },
      {
        title: indent() + browser.i18n.getMessage('config_openAllBookmarksWithStructureDiscarded_label'),
        key:   'openAllBookmarksWithStructureDiscarded',
        type:  'checkbox'
      }
    ]
  },
  {
    title:    browser.i18n.getMessage('config_newTab_caption'),
    children: [
      {
        title: browser.i18n.getMessage('config_newTabAction_caption'),
        enabled: false
      },
      {
        title: indent() + browser.i18n.getMessage('config_autoAttachOnNewTabCommand_before'),
        children: [
          {
            title: browser.i18n.getMessage('config_autoAttachOnNewTabCommand_noControl') + delimiter + browser.i18n.getMessage('config_autoAttachOnNewTabCommand_after'),
            key:   'autoAttachOnNewTabCommand',
            value: Constants.kNEWTAB_DO_NOTHING,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachOnNewTabCommand_independent') + delimiter + browser.i18n.getMessage('config_autoAttachOnNewTabCommand_after'),
            key:   'autoAttachOnNewTabCommand',
            value: Constants.kNEWTAB_OPEN_AS_ORPHAN,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachOnNewTabCommand_child') + delimiter + browser.i18n.getMessage('config_autoAttachOnNewTabCommand_after'),
            key:   'autoAttachOnNewTabCommand',
            value: Constants.kNEWTAB_OPEN_AS_CHILD,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachOnNewTabCommand_sibling') + delimiter + browser.i18n.getMessage('config_autoAttachOnNewTabCommand_after'),
            key:   'autoAttachOnNewTabCommand',
            value: Constants.kNEWTAB_OPEN_AS_SIBLING,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachOnNewTabCommand_nextSibling') + delimiter + browser.i18n.getMessage('config_autoAttachOnNewTabCommand_after'),
            key:   'autoAttachOnNewTabCommand',
            value: Constants.kNEWTAB_OPEN_AS_NEXT_SIBLING,
            type:  'radio'
          }
        ]
      },
      {
        title: browser.i18n.getMessage('config_inheritContextualIdentityToNewChildTab_label'),
        key:   'inheritContextualIdentityToNewChildTab',
        type:  'checkbox'
      },
      { type: 'separator' },
      {
        title: browser.i18n.getMessage('config_newTabButton_caption'),
        enabled: false
      },
      {
        title: indent() + browser.i18n.getMessage('config_autoAttachOnNewTabButtonMiddleClick_before'),
        children: [
          {
            title: browser.i18n.getMessage('config_autoAttachOnNewTabButtonMiddleClick_noControl') + delimiter + browser.i18n.getMessage('config_autoAttachOnNewTabButtonMiddleClick_after'),
            key:   'autoAttachOnNewTabButtonMiddleClick',
            value: Constants.kNEWTAB_DO_NOTHING,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachOnNewTabButtonMiddleClick_independent') + delimiter + browser.i18n.getMessage('config_autoAttachOnNewTabButtonMiddleClick_after'),
            key:   'autoAttachOnNewTabButtonMiddleClick',
            value: Constants.kNEWTAB_OPEN_AS_ORPHAN,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachOnNewTabButtonMiddleClick_child') + delimiter + browser.i18n.getMessage('config_autoAttachOnNewTabButtonMiddleClick_after'),
            key:   'autoAttachOnNewTabButtonMiddleClick',
            value: Constants.kNEWTAB_OPEN_AS_CHILD,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachOnNewTabButtonMiddleClick_sibling') + delimiter + browser.i18n.getMessage('config_autoAttachOnNewTabButtonMiddleClick_after'),
            key:   'autoAttachOnNewTabButtonMiddleClick',
            value: Constants.kNEWTAB_OPEN_AS_SIBLING,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachOnNewTabButtonMiddleClick_nextSibling') + delimiter + browser.i18n.getMessage('config_autoAttachOnNewTabButtonMiddleClick_after'),
            key:   'autoAttachOnNewTabButtonMiddleClick',
            value: Constants.kNEWTAB_OPEN_AS_NEXT_SIBLING,
            type:  'radio'
          }
        ]
      },
      {
        title:    indent() + browser.i18n.getMessage('config_longPressOnNewTabButton_before'),
        children: [
          {
            title: browser.i18n.getMessage('config_longPressOnNewTabButton_newTabAction') + delimiter + browser.i18n.getMessage('config_longPressOnNewTabButton_after'),
            key:   'longPressOnNewTabButton',
            value: 'newtab-action-selector',
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_longPressOnNewTabButton_contextualIdentities') + delimiter + browser.i18n.getMessage('config_longPressOnNewTabButton_after'),
            key:   'longPressOnNewTabButton',
            value: 'contextual-identities-selector',
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_longPressOnNewTabButton_none') + delimiter + browser.i18n.getMessage('config_longPressOnNewTabButton_after'),
            key:   'longPressOnNewTabButton',
            value: '',
            type:  'radio'
          }
        ]
      },
      {
        title: browser.i18n.getMessage('config_showNewTabActionSelector_label'),
        key:   'showNewTabActionSelector',
        type:  'checkbox'
      },
      {
        title: browser.i18n.getMessage('config_showContextualIdentitiesSelector_label'),
        key:   'showContextualIdentitiesSelector',
        type:  'checkbox'
      },
      { type: 'separator' },
      {
        title: browser.i18n.getMessage('config_autoAttachWithURL_caption'),
        enabled: false
      },
      {
        title:    indent() + browser.i18n.getMessage('config_autoAttachOnDuplicated_before'),
        children: [
          {
            title: browser.i18n.getMessage('config_autoAttachOnDuplicated_noControl') + delimiter + browser.i18n.getMessage('config_autoAttachOnDuplicated_after'),
            key:   'autoAttachOnDuplicated',
            value: Constants.kNEWTAB_DO_NOTHING,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachOnDuplicated_independent') + delimiter + browser.i18n.getMessage('config_autoAttachOnDuplicated_after'),
            key:   'autoAttachOnDuplicated',
            value: Constants.kNEWTAB_OPEN_AS_ORPHAN,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachOnDuplicated_child') + delimiter + browser.i18n.getMessage('config_autoAttachOnDuplicated_after'),
            key:   'autoAttachOnDuplicated',
            value: Constants.kNEWTAB_OPEN_AS_CHILD,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachOnDuplicated_sibling') + delimiter + browser.i18n.getMessage('config_autoAttachOnDuplicated_after'),
            key:   'autoAttachOnDuplicated',
            value: Constants.kNEWTAB_OPEN_AS_SIBLING,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachOnDuplicated_nextSibling') + delimiter + browser.i18n.getMessage('config_autoAttachOnDuplicated_after'),
            key:   'autoAttachOnDuplicated',
            value: Constants.kNEWTAB_OPEN_AS_NEXT_SIBLING,
            type:  'radio'
          }
        ]
      },
      {
        title:    indent() + browser.i18n.getMessage('config_sameSiteOrphan_caption'),
        children: [
          {
            title: browser.i18n.getMessage('config_autoAttachSameSiteOrphan_before') + delimiter + browser.i18n.getMessage('config_autoAttachSameSiteOrphan_noControl') + delimiter + browser.i18n.getMessage('config_autoAttachSameSiteOrphan_after'),
            key:   'autoAttachSameSiteOrphan',
            value: Constants.kNEWTAB_DO_NOTHING,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachSameSiteOrphan_before') + delimiter + browser.i18n.getMessage('config_autoAttachSameSiteOrphan_independent') + delimiter + browser.i18n.getMessage('config_autoAttachSameSiteOrphan_after'),
            key:   'autoAttachSameSiteOrphan',
            value: Constants.kNEWTAB_OPEN_AS_ORPHAN,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachSameSiteOrphan_before') + delimiter + browser.i18n.getMessage('config_autoAttachSameSiteOrphan_child') + delimiter + browser.i18n.getMessage('config_autoAttachSameSiteOrphan_after'),
            key:   'autoAttachSameSiteOrphan',
            value: Constants.kNEWTAB_OPEN_AS_CHILD,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachSameSiteOrphan_before') + delimiter + browser.i18n.getMessage('config_autoAttachSameSiteOrphan_sibling') + delimiter + browser.i18n.getMessage('config_autoAttachSameSiteOrphan_after'),
            key:   'autoAttachSameSiteOrphan',
            value: Constants.kNEWTAB_OPEN_AS_SIBLING,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachSameSiteOrphan_before') + delimiter + browser.i18n.getMessage('config_autoAttachSameSiteOrphan_nextSibling') + delimiter + browser.i18n.getMessage('config_autoAttachSameSiteOrphan_after'),
            key:   'autoAttachSameSiteOrphan',
            value: Constants.kNEWTAB_OPEN_AS_NEXT_SIBLING,
            type:  'radio'
          },
          { type: 'separator' },
          {
            title: browser.i18n.getMessage('config_inheritContextualIdentityToSameSiteOrphan_label'),
            key:   'inheritContextualIdentityToSameSiteOrphan',
            type:  'checkbox'
          }
        ]
      },
      {
        title:    indent() + browser.i18n.getMessage('config_fromExternal_caption'),
        children: [
          {
            title: browser.i18n.getMessage('config_autoAttachOnOpenedFromExternal_before') + delimiter + browser.i18n.getMessage('config_autoAttachOnOpenedFromExternal_noControl') + delimiter + browser.i18n.getMessage('config_autoAttachOnOpenedFromExternal_after'),
            key:   'autoAttachOnOpenedFromExternal',
            value: Constants.kNEWTAB_DO_NOTHING,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachOnOpenedFromExternal_before') + delimiter + browser.i18n.getMessage('config_autoAttachOnOpenedFromExternal_independent') + delimiter + browser.i18n.getMessage('config_autoAttachOnOpenedFromExternal_after'),
            key:   'autoAttachOnOpenedFromExternal',
            value: Constants.kNEWTAB_OPEN_AS_ORPHAN,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachOnOpenedFromExternal_before') + delimiter + browser.i18n.getMessage('config_autoAttachOnOpenedFromExternal_child') + delimiter + browser.i18n.getMessage('config_autoAttachOnOpenedFromExternal_after'),
            key:   'autoAttachOnOpenedFromExternal',
            value: Constants.kNEWTAB_OPEN_AS_CHILD,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachOnOpenedFromExternal_before') + delimiter + browser.i18n.getMessage('config_autoAttachOnOpenedFromExternal_sibling') + delimiter + browser.i18n.getMessage('config_autoAttachOnOpenedFromExternal_after'),
            key:   'autoAttachOnOpenedFromExternal',
            value: Constants.kNEWTAB_OPEN_AS_SIBLING,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachOnOpenedFromExternal_before') + delimiter + browser.i18n.getMessage('config_autoAttachOnOpenedFromExternal_nextSibling') + delimiter + browser.i18n.getMessage('config_autoAttachOnOpenedFromExternal_after'),
            key:   'autoAttachOnOpenedFromExternal',
            value: Constants.kNEWTAB_OPEN_AS_NEXT_SIBLING,
            type:  'radio'
          },
          { type: 'separator' },
          {
            title: browser.i18n.getMessage('config_inheritContextualIdentityToTabsFromExternal_label'),
            key:   'inheritContextualIdentityToTabsFromExternal',
            type:  'checkbox'
          }
        ]
      },
      { type: 'separator' },
      {
        title:    browser.i18n.getMessage('config_insertNewChildAt_caption'),
        children: [
          {
            title: browser.i18n.getMessage('config_insertNewChildAt_noControl'),
            key:   'insertNewChildAt',
            value: Constants.kINSERT_NO_CONTROL,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_insertNewChildAt_first'),
            key:   'insertNewChildAt',
            value: Constants.kINSERT_FIRST,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_insertNewChildAt_end'),
            key:   'insertNewChildAt',
            value: Constants.kINSERT_END,
            type:  'radio'
          }
        ]
      },
      {
        title:    browser.i18n.getMessage('config_insertNewTabFromPinnedTabAt_caption'),
        children: [
          {
            title: browser.i18n.getMessage('config_insertNewTabFromPinnedTabAt_noControl'),
            key:   'insertNewTabFromPinnedTabAt',
            value: Constants.kINSERT_NO_CONTROL,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_insertNewTabFromPinnedTabAt_first'),
            key:   'insertNewTabFromPinnedTabAt',
            value: Constants.kINSERT_FIRST,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_insertNewTabFromPinnedTabAt_end'),
            key:   'insertNewTabFromPinnedTabAt',
            value: Constants.kINSERT_END,
            type:  'radio'
          }
        ]
      },
      { type: 'separator' },
      {
        title: browser.i18n.getMessage('config_groupTab_caption'),
        enabled: false
      },
      {
        dynamicTitle: true,
        get title() {
          return indent() + browser.i18n.getMessage('config_autoGroupNewTabs_before') + delimiter + configs.autoGroupNewTabsTimeout + delimiter + browser.i18n.getMessage('config_autoGroupNewTabs_after');
        },
        key:   'autoGroupNewTabs',
        type:  'checkbox'
      },
      {
        title: indent() + browser.i18n.getMessage('config_autoGroupNewTabsFromPinned_label'),
        key:   'autoGroupNewTabsFromPinned',
        type:  'checkbox'
      },
      {
        title: indent() + browser.i18n.getMessage('config_renderTreeInGroupTabs_label'),
        key:   'renderTreeInGroupTabs',
        type:  'checkbox',
        expert: true
      }
    ]
  },
  {
    title:    browser.i18n.getMessage('config_treeBehavior_caption'),
    children: [
      {
        title: browser.i18n.getMessage('config_autoCollapseExpandSubtreeOnAttach_label'),
        key:   'autoCollapseExpandSubtreeOnAttach',
        type:  'checkbox'
      },
      {
        title: browser.i18n.getMessage('config_autoCollapseExpandSubtreeOnSelect_label'),
        key:   'autoCollapseExpandSubtreeOnSelect',
        type:  'checkbox'
      },
      {
        title: indent() + browser.i18n.getMessage('config_autoCollapseExpandSubtreeOnSelectExceptActiveTabRemove_label'),
        key:   'autoCollapseExpandSubtreeOnSelectExceptActiveTabRemove',
        type:  'checkbox',
        expert: true
      },
      {
        title: browser.i18n.getMessage('config_autoExpandOnCollapsedChildActive_label'),
        key:   'autoExpandOnCollapsedChildActive',
        type:  'checkbox',
        expert: true
      },
      {
        title: indent() + browser.i18n.getMessage('config_autoExpandOnCollapsedChildActiveUnderLockedCollapsed_label'),
        key:   'autoExpandOnCollapsedChildActiveUnderLockedCollapsed',
        type:  'checkbox',
        expert: true
      },
      {
        title: browser.i18n.getMessage('config_autoDiscardTabForUnexpectedFocus_label'),
        key:   'autoDiscardTabForUnexpectedFocus',
        type:  'checkbox',
        expert: true
      },
      {
        title: browser.i18n.getMessage('config_avoidDiscardedTabToBeActivatedIfPossible_label'),
        key:   'avoidDiscardedTabToBeActivatedIfPossible',
        type:  'checkbox'
      },
      {
        title:    browser.i18n.getMessage('config_treeDoubleClickBehavior_caption'),
        children: [
          {
            title: browser.i18n.getMessage('config_treeDoubleClickBehavior_toggleLockCollapsed'),
            key:   'treeDoubleClickBehavior',
            value: Constants.kTREE_DOUBLE_CLICK_BEHAVIOR_TOGGLE_LOCK_COLLAPSED,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_treeDoubleClickBehavior_toggleCollapsed'),
            key:   'treeDoubleClickBehavior',
            value: Constants.kTREE_DOUBLE_CLICK_BEHAVIOR_TOGGLE_COLLAPSED,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_treeDoubleClickBehavior_none'),
            key:   'treeDoubleClickBehavior',
            value: Constants.kTREE_DOUBLE_CLICK_BEHAVIOR_NONE,
            type:  'radio'
          }
        ]
      },
      {
        title:    browser.i18n.getMessage('config_successorTabControlLevel_caption'),
        children: [
          {
            title: browser.i18n.getMessage('config_successorTabControlLevel_inTree'),
            key:   'successorTabControlLevel',
            value: Constants.kSUCCESSOR_TAB_CONTROL_IN_TREE,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_successorTabControlLevel_simulateDefault'),
            key:   'successorTabControlLevel',
            value: Constants.kSUCCESSOR_TAB_CONTROL_SIMULATE_DEFAULT,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_successorTabControlLevel_never'),
            key:   'successorTabControlLevel',
            value: Constants.kSUCCESSOR_TAB_CONTROL_NEVER,
            type:  'radio'
          }
        ]
      },
      {
        title: browser.i18n.getMessage('config_simulateSelectOwnerOnClose_label'),
        key:   'simulateSelectOwnerOnClose',
        type:  'checkbox',
        get visible() {
          return typeof browser.tabs.moveInSuccession == 'function';
        }
      },
      {
        title:    browser.i18n.getMessage('config_closeParentBehaviorMode_caption'),
        children: [
          {
            title: browser.i18n.getMessage('config_closeParentBehaviorMode_withNativeTabs'),
            key:   'closeParentBehaviorMode',
            value: Constants.kCLOSE_PARENT_BEHAVIOR_MODE_WITH_NATIVE_TABBAR,
            type:  'radio'
          },
          {
            title: indent() + browser.i18n.getMessage('config_closeParentBehaviorMode_withNativeTabs_caption_withoutSidebar')
          },
          {
            title: indent() + browser.i18n.getMessage('config_closeParentBehaviorMode_withNativeTabs_caption_withSidebar'),
            children: [
              {
                title: browser.i18n.getMessage('config_closeParentBehavior_replaceWithGroupTab'),
                key:   'closeParentBehavior',
                value: Constants.kCLOSE_PARENT_BEHAVIOR_REPLACE_WITH_GROUP_TAB,
                type:  'radio'
              },
              {
                title: browser.i18n.getMessage('config_closeParentBehavior_promoteFirst'),
                key:   'closeParentBehavior',
                value: Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD,
                type:  'radio'
              },
              {
                title: browser.i18n.getMessage('config_closeParentBehavior_promoteAll'),
                key:   'closeParentBehavior',
                value: Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN,
                type:  'radio'
              },
              {
                title: browser.i18n.getMessage('config_closeParentBehavior_promoteIntelligently'),
                key:   'closeParentBehavior',
                value: Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_INTELLIGENTLY,
                type:  'radio'
              }
            ]
          },
          { type: 'separator' },
          {
            title: browser.i18n.getMessage('config_closeParentBehaviorMode_withoutNativeTabs'),
            key:   'closeParentBehaviorMode',
            value: Constants.kCLOSE_PARENT_BEHAVIOR_MODE_WITHOUT_NATIVE_TABBAR,
            type:  'radio'
          },
          {
            title: indent() + browser.i18n.getMessage('config_closeParentBehaviorMode_withoutNativeTabs_caption'),
            children: [
              {
                title: browser.i18n.getMessage('config_closeParentBehavior_replaceWithGroupTab'),
                key:   'closeParentBehavior',
                value: Constants.kCLOSE_PARENT_BEHAVIOR_REPLACE_WITH_GROUP_TAB,
                type:  'radio'
              },
              {
                title: browser.i18n.getMessage('config_closeParentBehavior_promoteFirst'),
                key:   'closeParentBehavior',
                value: Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD,
                type:  'radio'
              },
              {
                title: browser.i18n.getMessage('config_closeParentBehavior_promoteAll'),
                key:   'closeParentBehavior',
                value: Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN,
                type:  'radio'
              },
              {
                title: browser.i18n.getMessage('config_closeParentBehavior_promoteIntelligently'),
                key:   'closeParentBehavior',
                value: Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_INTELLIGENTLY,
                type:  'radio'
              }
            ]
          },
          { type: 'separator' },
          {
            title: browser.i18n.getMessage('config_closeParentBehaviorMode_custom'),
            key:   'closeParentBehaviorMode',
            value: Constants.kCLOSE_PARENT_BEHAVIOR_MODE_CUSTOM,
            type:  'radio'
          },
          {
            title: indent() + browser.i18n.getMessage('config_closeParentBehaviorMode_custom_caption_insideSidebar'),
            children: [
              {
                title: browser.i18n.getMessage('config_closeParentBehavior_close'),
                key:   'closeParentBehavior',
                value: Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN,
                type:  'radio'
              },
              {
                title: browser.i18n.getMessage('config_closeParentBehavior_replaceWithGroupTab'),
                key:   'closeParentBehavior',
                value: Constants.kCLOSE_PARENT_BEHAVIOR_REPLACE_WITH_GROUP_TAB,
                type:  'radio'
              },
              {
                title: browser.i18n.getMessage('config_closeParentBehavior_promoteFirst'),
                key:   'closeParentBehavior',
                value: Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD,
                type:  'radio'
              },
              {
                title: browser.i18n.getMessage('config_closeParentBehavior_promoteAll'),
                key:   'closeParentBehavior',
                value: Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN,
                type:  'radio'
              },
              {
                title: browser.i18n.getMessage('config_closeParentBehavior_promoteIntelligently'),
                key:   'closeParentBehavior',
                value: Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_INTELLIGENTLY,
                type:  'radio'
              },
              {
                title: browser.i18n.getMessage('config_closeParentBehavior_detach'),
                key:   'closeParentBehavior',
                value: Constants.kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN,
                type:  'radio'
              }
            ]
          },
          {
            title: indent() + browser.i18n.getMessage('config_closeParentBehaviorMode_custom_caption_outsideSidebar'),
            children: [
              {
                title: browser.i18n.getMessage('config_closeParentBehavior_close'),
                key:   'closeParentBehavior_outsideSidebar',
                value: Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN,
                type:  'radio'
              },
              {
                title: browser.i18n.getMessage('config_closeParentBehavior_replaceWithGroupTab'),
                key:   'closeParentBehavior_outsideSidebar',
                value: Constants.kCLOSE_PARENT_BEHAVIOR_REPLACE_WITH_GROUP_TAB,
                type:  'radio'
              },
              {
                title: browser.i18n.getMessage('config_closeParentBehavior_promoteFirst'),
                key:   'closeParentBehavior_outsideSidebar',
                value: Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD,
                type:  'radio'
              },
              {
                title: browser.i18n.getMessage('config_closeParentBehavior_promoteAll'),
                key:   'closeParentBehavior_outsideSidebar',
                value: Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN,
                type:  'radio'
              },
              {
                title: browser.i18n.getMessage('config_closeParentBehavior_promoteIntelligently'),
                key:   'closeParentBehavior_outsideSidebar',
                value: Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_INTELLIGENTLY,
                type:  'radio'
              },
              {
                title: browser.i18n.getMessage('config_closeParentBehavior_detach'),
                key:   'closeParentBehavior_outsideSidebar',
                value: Constants.kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN,
                type:  'radio'
              }
            ]
          },
          {
            title: indent() + browser.i18n.getMessage('config_closeParentBehaviorMode_custom_caption_noSidebar'),
            children: [
              {
                title: browser.i18n.getMessage('config_closeParentBehavior_close'),
                key:   'closeParentBehavior_noSidebar',
                value: Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN,
                type:  'radio'
              },
              {
                title: browser.i18n.getMessage('config_closeParentBehavior_replaceWithGroupTab'),
                key:   'closeParentBehavior_noSidebar',
                value: Constants.kCLOSE_PARENT_BEHAVIOR_REPLACE_WITH_GROUP_TAB,
                type:  'radio'
              },
              {
                title: browser.i18n.getMessage('config_closeParentBehavior_promoteFirst'),
                key:   'closeParentBehavior_noSidebar',
                value: Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD,
                type:  'radio'
              },
              {
                title: browser.i18n.getMessage('config_closeParentBehavior_promoteAll'),
                key:   'closeParentBehavior_noSidebar',
                value: Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN,
                type:  'radio'
              },
              {
                title: browser.i18n.getMessage('config_closeParentBehavior_promoteIntelligently'),
                key:   'closeParentBehavior_noSidebar',
                value: Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_INTELLIGENTLY,
                type:  'radio'
              },
              {
                title: browser.i18n.getMessage('config_closeParentBehavior_detach'),
                key:   'closeParentBehavior_noSidebar',
                value: Constants.kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN,
                type:  'radio'
              }
            ]
          }
        ]
      },
      {
        title:    browser.i18n.getMessage('config_fixupTreeOnTabVisibilityChanged_caption'),
        children: [
          {
            title: browser.i18n.getMessage('config_fixupTreeOnTabVisibilityChanged_fix'),
            key:   'fixupTreeOnTabVisibilityChanged',
            value: true,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_fixupTreeOnTabVisibilityChanged_keep'),
            key:   'fixupTreeOnTabVisibilityChanged',
            value: false,
            type:  'radio'
          }
        ]
      }
    ]
  },
  {
    title:    browser.i18n.getMessage('config_drag_caption'),
    children: [
      {
        title:  browser.i18n.getMessage('config_moveDroppedTabToNewWindowForUnhandledDragEvent_label'),
        key:    'moveDroppedTabToNewWindowForUnhandledDragEvent',
        type:   'checkbox',
        expert: true
      },
      { type: 'separator', expert: true },
      {
        title: browser.i18n.getMessage('config_tabDragBehavior_caption'),
        enabled: false
      },
      {
        title:    indent() + browser.i18n.getMessage('config_tabDragBehavior_label'),
        children: [
          {
            title: browser.i18n.getMessage('config_tabDragBehavior_tearoff_tree'),
            key:   'tabDragBehavior',
            value: Constants.kDRAG_BEHAVIOR_TEAR_OFF | Constants.kDRAG_BEHAVIOR_WHOLE_TREE,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_tabDragBehavior_bookmark_tree'),
            key:   'tabDragBehavior',
            value: Constants.kDRAG_BEHAVIOR_WHOLE_TREE | Constants.kDRAG_BEHAVIOR_ALLOW_BOOKMARK,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_tabDragBehavior_tearoff_tab'),
            key:   'tabDragBehavior',
            value: Constants.kDRAG_BEHAVIOR_TEAR_OFF,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_tabDragBehavior_bookmark_tab'),
            key:   'tabDragBehavior',
            value: Constants.kDRAG_BEHAVIOR_ALLOW_BOOKMARK,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_tabDragBehavior_none'),
            key:   'tabDragBehavior',
            value: Constants.kDRAG_BEHAVIOR_NONE,
            type:  'radio'
          }
        ]
      },
      {
        title:    indent() + browser.i18n.getMessage('config_tabDragBehaviorShift_label'),
        children: [
          {
            title: browser.i18n.getMessage('config_tabDragBehavior_tearoff_tree'),
            key:   'tabDragBehaviorShift',
            value: Constants.kDRAG_BEHAVIOR_TEAR_OFF | Constants.kDRAG_BEHAVIOR_WHOLE_TREE,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_tabDragBehavior_bookmark_tree'),
            key:   'tabDragBehaviorShift',
            value: Constants.kDRAG_BEHAVIOR_WHOLE_TREE | Constants.kDRAG_BEHAVIOR_ALLOW_BOOKMARK,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_tabDragBehavior_tearoff_tab'),
            key:   'tabDragBehaviorShift',
            value: Constants.kDRAG_BEHAVIOR_TEAR_OFF,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_tabDragBehavior_bookmark_tab'),
            key:   'tabDragBehaviorShift',
            value: Constants.kDRAG_BEHAVIOR_ALLOW_BOOKMARK,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_tabDragBehavior_none'),
            key:   'tabDragBehaviorShift',
            value: Constants.kDRAG_BEHAVIOR_NONE,
            type:  'radio'
          }
        ]
      },
      {
        title: browser.i18n.getMessage('config_showTabDragHandle_label'),
        key:   'showTabDragHandle',
        type:  'checkbox'
      },
      {
        title: browser.i18n.getMessage('config_showTabDragBehaviorNotification_label'),
        key:   'showTabDragBehaviorNotification',
        type:  'checkbox'
      },
      { type: 'separator' },
      {
        title:    browser.i18n.getMessage('config_dropLinksOnTabBehavior_caption'),
        children: [
          {
            title: browser.i18n.getMessage('config_dropLinksOnTabBehavior_ask'),
            key:   'dropLinksOnTabBehavior',
            value: Constants.kDROPLINK_ASK,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_dropLinksOnTabBehavior_load'),
            key:   'dropLinksOnTabBehavior',
            value: Constants.kDROPLINK_LOAD,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_dropLinksOnTabBehavior_newtab'),
            key:   'dropLinksOnTabBehavior',
            value: Constants.kDROPLINK_NEWTAB,
            type:  'radio'
          }
        ]
      },
      { type: 'separator', expert: true },
      {
        dynamicTitle: true,
        get title() {
          return browser.i18n.getMessage('config_autoExpandOnLongHoverDelay_before') + delimiter + configs.autoExpandOnLongHoverDelay + delimiter + browser.i18n.getMessage('config_autoExpandOnLongHoverDelay_after');
        },
        key:    'autoExpandOnLongHover',
        type:   'checkbox',
        expert: true
      },
      {
        title:   indent() + browser.i18n.getMessage('config_autoExpandOnLongHoverRestoreIniitalState_label'),
        key:    'autoExpandOnLongHoverRestoreIniitalState',
        type:   'checkbox',
        expert: true
      },
      {
        title:   indent() + browser.i18n.getMessage('config_autoExpandIntelligently_label'),
        key:    'autoExpandIntelligently',
        type:   'checkbox',
        expert: true
      }
    ]
  },
  {
    title:    browser.i18n.getMessage('config_more_caption'),
    children: [
      {
        title:   browser.i18n.getMessage('config_shortcuts_caption'),
        enabled: false,
        expert:  true
      },
      {
        dynamicTitle: true,
        get title() {
          return indent() + browser.i18n.getMessage('config_autoExpandOnTabSwitchingShortcutsDelay_before') + delimiter + configs.autoExpandOnTabSwitchingShortcutsDelay + delimiter + browser.i18n.getMessage('config_autoExpandOnTabSwitchingShortcutsDelay_after');
        },
        key:   'autoExpandOnTabSwitchingShortcuts',
        type:  'checkbox',
        expert: true
      },
      { type: 'separator', expert: true },
      {
        title:   browser.i18n.getMessage('config_advanced_caption'),
        enabled: false
      },
      {
        title: indent() + browser.i18n.getMessage('config_warnOnCloseTabs_label'),
        key:   'warnOnCloseTabs',
        type:  'checkbox'
      },
      {
        title: indent(2) + browser.i18n.getMessage('config_warnOnCloseTabsByClosebox_label'),
        key:   'warnOnCloseTabsByClosebox',
        type:  'checkbox',
        expert: true
      },
      {
        title: indent() + browser.i18n.getMessage('config_useCachedTree_label'),
        key:   'useCachedTree',
        type:  'checkbox'
      },
      {
        title: indent() + browser.i18n.getMessage('config_simulateCloseTabByDblclick_label'),
        key:   'simulateCloseTabByDblclick',
        type:  'checkbox'
      },
      {
        title: indent() + browser.i18n.getMessage('config_supportTabsMultiselect_label'),
        key:   'supportTabsMultiselect',
        type:  'checkbox',
        expert: true
      },
      { type: 'separator' },
      {
        title:   browser.i18n.getMessage('config_debug_caption'),
        enabled: false
      },
      {
        title: indent() + browser.i18n.getMessage('config_loggingQueries_label'),
        key:   'loggingQueries',
        type:  'checkbox'
      },
      { type: 'separator' },
      {
        title: indent() + browser.i18n.getMessage('config_debug_label'),
        key:   'debug',
        type:  'checkbox'
      },
      { type: 'separator' },
      {
        title: browser.i18n.getMessage('config_showExpertOptions_label'),
        key:   'showExpertOptions',
        type:  'checkbox'
      }
    ]
  }
];

const mItemsById = new Map();
const mUpdatableItemsById = new Map();
const mExpertItems = new Set();

function createItem(id, item, parent) {
  if (item.visible === false)
    return;

  const parentId = parent ? parent.id : null ;
  item.id = id;
  mItemsById.set(id, item);

  if (item.dynamicTitle) {
    item.lastTitle = item.title;
    mUpdatableItemsById.set(id, item);
  }
  if (item.type == 'checkbox' || item.type == 'radio') {
    mUpdatableItemsById.set(id, item);
  }

  const params = {
    id,
    title:    item.title && item.title.replace(/^:|:$/g, ''),
    type:     item.type || 'normal',
    contexts: ['browser_action'],
    parentId
  };
  if ('enabled' in item)
    params.enabled = item.enabled;
  log('create: ', params);
  id = browser.menus.create(params);
  if (item.expert)
    mExpertItems.add(id);
  if (item.children) {
    for (let i = 0, maxi = item.children.length; i < maxi; i++) {
      const child = item.children[i];
      createItem(`${id}:${i}`, child, item);
    }
  }
}

for (let i = 0, maxi = mItems.length; i < maxi; i++) {
  createItem(`browserActionItem:${i}`, mItems[i]);
}

browser.menus.onShown.addListener((info, _tab) => {
  if (!info.contexts.includes('browser_action'))
    return;

  let updated = false;
  for (const item of mUpdatableItemsById.values()) {
    const params = {};
    if (item.dynamicTitle) {
      const title = item.title;
      if (title != item.lastTitle) {
        item.lastTitle = title;
        params.title = title;
      }
    }
    if (item.type == 'checkbox' || item.type == 'radio')
      params.checked = 'value' in item ? configs[item.key] == item.value : configs[item.key];
    if ('visible' in item)
      params.visible = item.visible;
    if ('checked' in params || 'title' in params) {
      browser.menus.update(item.id, params).catch(ApiTabs.createErrorSuppressor());
      updated = true;
    }
  }
  if (updated)
    browser.menus.refresh().catch(ApiTabs.createErrorSuppressor());
});

browser.menus.onClicked.addListener((info, _tab) => {
  const item = mItemsById.get(info.menuItemId);
  log('onClicked ', { id: info.menuItemId, item });
  if (!item || !item.key)
    return;

  configs[item.key] = 'value' in item ? item.value : !configs[item.key];
});


function updateExpertOptionsVisibility() {
  for (const id of mExpertItems) {
    browser.menus.update(id, { visible: configs.showExpertOptions });
  }
  browser.menus.refresh();
}
configs.$addObserver(key => {
  if (key == 'showExpertOptions')
    updateExpertOptionsVisibility();
});
configs.$loaded.then(updateExpertOptionsVisibility);
