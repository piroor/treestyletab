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

function log(...args) {
  internalLogger('background/browser-action-menu', ...args);
}

const isMac = /^Mac/i.test(navigator.platform);
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
            value: 1,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_sidebarPosition_right'),
            key:   'sidebarPosition',
            value: 2,
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
            value: 1,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_sidebarDirection_rtl'),
            key:   'sidebarDirection',
            value: 2,
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
        title:    browser.i18n.getMessage('config_scrollbarMode_caption'),
        children: [
          {
            title: browser.i18n.getMessage('config_scrollbarMode_default'),
            key:   'scrollbarMode',
            value: 0,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_scrollbarMode_narrow'),
            key:   'scrollbarMode',
            value: 1,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_scrollbarMode_overlay'),
            key:   'scrollbarMode',
            value: 3,
            type:  'radio',
            visible: isMac
          },
          {
            title: browser.i18n.getMessage('config_scrollbarMode_hide'),
            key:   'scrollbarMode',
            value: 2,
            type:  'radio'
          }
        ]
      },
      {
        title:    browser.i18n.getMessage('config_sidebarScrollbarPosition_caption'),
        children: [
          {
            title: browser.i18n.getMessage('config_sidebarScrollbarPosition_auto'),
            key:   'sidebarScrollbarPosition',
            value: 0,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_sidebarScrollbarPosition_left'),
            key:   'sidebarScrollbarPosition',
            value: 1,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_sidebarScrollbarPosition_right'),
            key:   'sidebarScrollbarPosition',
            value: 2,
            type:  'radio'
          }
        ]
      },
      {
        title: browser.i18n.getMessage('config_faviconizePinnedTabs_label'),
        key:   'faviconizePinnedTabs',
        type:  'checkbox'
      },
      {
        title: browser.i18n.getMessage('config_animation_label'),
        key:   'animation',
        type:  'checkbox'
      },
      {
        title: browser.i18n.getMessage('config_showCollapsedDescendantsByTooltip_label'),
        key:   'showCollapsedDescendantsByTooltip',
        type:  'checkbox'
      },
      {
        title: browser.i18n.getMessage('config_applyThemeColorToIcon_label'),
        key:   'applyThemeColorToIcon',
        type:  'checkbox'
      }
    ]
  },
  {
    title:    browser.i18n.getMessage('config_context_caption'),
    children: [
      {
        title: browser.i18n.getMessage('config_fakeContextMenu_label'),
        key:   'fakeContextMenu',
        type:  'checkbox'
      }
    ]
  },
  {
    title:    browser.i18n.getMessage('config_newTab_caption'),
    children: [
      {
        title: browser.i18n.getMessage('config_newTabButton_caption')
      },
      {
        title: indent() + browser.i18n.getMessage('config_autoAttachOnNewTabButtonMiddleClick_before'),
        children: [
          {
            title: browser.i18n.getMessage('config_autoAttachOnNewTabButtonMiddleClick_independent') + delimiter + browser.i18n.getMessage('config_autoAttachOnNewTabButtonMiddleClick_after'),
            key:   'autoAttachOnNewTabButtonMiddleClick',
            value: 0,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachOnNewTabButtonMiddleClick_child') + delimiter + browser.i18n.getMessage('config_autoAttachOnNewTabButtonMiddleClick_after'),
            key:   'autoAttachOnNewTabButtonMiddleClick',
            value: 1,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachOnNewTabButtonMiddleClick_sibling') + delimiter + browser.i18n.getMessage('config_autoAttachOnNewTabButtonMiddleClick_after'),
            key:   'autoAttachOnNewTabButtonMiddleClick',
            value: 2,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachOnNewTabButtonMiddleClick_nextSibling') + delimiter + browser.i18n.getMessage('config_autoAttachOnNewTabButtonMiddleClick_after'),
            key:   'autoAttachOnNewTabButtonMiddleClick',
            value: 3,
            type:  'radio',
            visible: isMac
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
        title: browser.i18n.getMessage('config_newTabAction_caption')
      },
      {
        title:    indent() + browser.i18n.getMessage('config_autoAttachOnNewTabCommand_before'),
        children: [
          {
            title: browser.i18n.getMessage('config_autoAttachOnNewTabCommand_independent') + delimiter + browser.i18n.getMessage('config_autoAttachOnNewTabCommand_after'),
            key:   'autoAttachOnNewTabCommand',
            value: 0,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachOnNewTabCommand_child') + delimiter + browser.i18n.getMessage('config_autoAttachOnNewTabCommand_after'),
            key:   'autoAttachOnNewTabCommand',
            value: 1,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachOnNewTabCommand_sibling') + delimiter + browser.i18n.getMessage('config_autoAttachOnNewTabCommand_after'),
            key:   'autoAttachOnNewTabCommand',
            value: 2,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachOnNewTabCommand_nextSibling') + delimiter + browser.i18n.getMessage('config_autoAttachOnNewTabCommand_after'),
            key:   'autoAttachOnNewTabCommand',
            value: 3,
            type:  'radio',
            visible: isMac
          }
        ]
      },
      {
        title:    indent() + browser.i18n.getMessage('config_autoAttachOnDuplicated_before'),
        children: [
          {
            title: browser.i18n.getMessage('config_autoAttachOnDuplicated_independent') + delimiter + browser.i18n.getMessage('config_autoAttachOnDuplicated_after'),
            key:   'autoAttachOnDuplicated',
            value: 0,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachOnDuplicated_child') + delimiter + browser.i18n.getMessage('config_autoAttachOnDuplicated_after'),
            key:   'autoAttachOnDuplicated',
            value: 1,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachOnDuplicated_sibling') + delimiter + browser.i18n.getMessage('config_autoAttachOnDuplicated_after'),
            key:   'autoAttachOnDuplicated',
            value: 2,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachOnDuplicated_nextSibling') + delimiter + browser.i18n.getMessage('config_autoAttachOnDuplicated_after'),
            key:   'autoAttachOnDuplicated',
            value: 3,
            type:  'radio',
            visible: isMac
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
        title:    browser.i18n.getMessage('config_sameSiteOrphan_caption'),
        children: [
          {
            title: browser.i18n.getMessage('config_autoAttachSameSiteOrphan_before') + delimiter + browser.i18n.getMessage('config_autoAttachSameSiteOrphan_independent') + delimiter + browser.i18n.getMessage('config_autoAttachSameSiteOrphan_after'),
            key:   'autoAttachSameSiteOrphan',
            value: 0,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachSameSiteOrphan_before') + delimiter + browser.i18n.getMessage('config_autoAttachSameSiteOrphan_child') + delimiter + browser.i18n.getMessage('config_autoAttachSameSiteOrphan_after'),
            key:   'autoAttachSameSiteOrphan',
            value: 1,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachSameSiteOrphan_before') + delimiter + browser.i18n.getMessage('config_autoAttachSameSiteOrphan_sibling') + delimiter + browser.i18n.getMessage('config_autoAttachSameSiteOrphan_after'),
            key:   'autoAttachSameSiteOrphan',
            value: 2,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_autoAttachSameSiteOrphan_before') + delimiter + browser.i18n.getMessage('config_autoAttachSameSiteOrphan_nextSibling') + delimiter + browser.i18n.getMessage('config_autoAttachSameSiteOrphan_after'),
            key:   'autoAttachSameSiteOrphan',
            value: 3,
            type:  'radio',
            visible: isMac
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
        title:    browser.i18n.getMessage('config_insertNewChildAt_caption'),
        children: [
          {
            title: browser.i18n.getMessage('config_insertNewChildAt_noControl'),
            key:   'insertNewChildAt',
            value: -1,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_insertNewChildAt_first'),
            key:   'insertNewChildAt',
            value: 0,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_insertNewChildAt_end'),
            key:   'insertNewChildAt',
            value: 1,
            type:  'radio'
          }
        ]
      },
      {
        title:    browser.i18n.getMessage('config_insertNewTabFromPinnedTabAt_caption'),
        children: [
          {
            title: browser.i18n.getMessage('config_insertNewTabFromPinnedTabAt_caption'),
            key:   'autoGroupNewTabsFromPinned',
            type:  'checkbox'
          },
          { type:  'separator' },
          {
            title: browser.i18n.getMessage('config_insertNewTabFromPinnedTabAt_noControl'),
            key:   'insertNewTabFromPinnedTabAt',
            value: -1,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_insertNewTabFromPinnedTabAt_first'),
            key:   'insertNewTabFromPinnedTabAt',
            value: 0,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_insertNewTabFromPinnedTabAt_end'),
            key:   'insertNewTabFromPinnedTabAt',
            value: 1,
            type:  'radio'
          }
        ]
      },
      {
        dynamicTitle: true,
        get title() {
          return browser.i18n.getMessage('config_autoGroupNewTabs_before') + delimiter + configs.autoGroupNewTabsTimeout + delimiter + browser.i18n.getMessage('config_autoGroupNewTabs_after');
        },
        key:   'autoGroupNewTabs',
        type:  'checkbox'
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
        title: indent() + browser.i18n.getMessage('config_autoCollapseExpandSubtreeOnSelectExceptCurrentTabRemove_label'),
        key:   'autoCollapseExpandSubtreeOnSelectExceptCurrentTabRemove',
        type:  'checkbox'
      },
      {
        title: browser.i18n.getMessage('config_collapseExpandSubtreeByDblClick_label'),
        key:   'collapseExpandSubtreeByDblClick',
        type:  'checkbox'
      },
      {
        title:    browser.i18n.getMessage('config_moveFocusInTreeForClosedCurrentTab_caption'),
        children: [
          {
            title: browser.i18n.getMessage('config_moveFocusInTreeForClosedCurrentTab_true'),
            key:   'moveFocusInTreeForClosedCurrentTab',
            value: 'true',
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_moveFocusInTreeForClosedCurrentTab_false'),
            key:   'moveFocusInTreeForClosedCurrentTab',
            value: 'false',
            type:  'radio'
          }
        ]
      },
      {
        title:    browser.i18n.getMessage('config_closeParentBehavior_caption'),
        children: [
          {
            title: browser.i18n.getMessage('config_closeParentBehavior_close'),
            key:   'closeParentBehavior',
            value: 2,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_closeParentBehavior_replaceWithGroupTab'),
            key:   'closeParentBehavior',
            value: 5,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_closeParentBehavior_promoteFirst'),
            key:   'closeParentBehavior',
            value: 3,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_closeParentBehavior_promoteAll'),
            key:   'closeParentBehavior',
            value: 0,
            type:  'radio'
          },
          {
            title: indent() + browser.i18n.getMessage('config_promoteFirstChildForClosedRoot_label'),
            key:   'promoteFirstChildForClosedRoot',
            value: 1,
            type:  'checkbox'
          },
          {
            title: browser.i18n.getMessage('config_closeParentBehavior_detach'),
            key:   'closeParentBehavior',
            value: 1,
            type:  'radio'
          }
        ]
      },
      {
        title:    browser.i18n.getMessage('config_parentTabBehaviorForChanges_caption'),
        children: [
          {
            title: browser.i18n.getMessage('config_parentTabBehaviorForChanges_always'),
            key:   'parentTabBehaviorForChanges',
            value: 0,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_parentTabBehaviorForChanges_alwaysButOnlyWhenVisible'),
            key:   'parentTabBehaviorForChanges',
            value: 1,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_parentTabBehaviorForChanges_onlyInSidebar'),
            key:   'parentTabBehaviorForChanges',
            value: 2,
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
        title: browser.i18n.getMessage('config_tabDragBehavior_caption')
      },
      {
        title:    indent() + browser.i18n.getMessage('config_tabDragBehavior_label'),
        children: [
          {
            title: browser.i18n.getMessage('config_tabDragBehavior_tearoff_tree'),
            key:   'tabDragBehavior',
            value: 1,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_tabDragBehavior_bookmark_tree'),
            key:   'tabDragBehavior',
            value: 3,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_tabDragBehavior_tearoff_tab'),
            key:   'tabDragBehavior',
            value: 0,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_tabDragBehavior_bookmark_tab'),
            key:   'tabDragBehavior',
            value: 2,
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
            value: 1,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_tabDragBehavior_bookmark_tree'),
            key:   'tabDragBehaviorShift',
            value: 3,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_tabDragBehavior_tearoff_tab'),
            key:   'tabDragBehaviorShift',
            value: 0,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_tabDragBehavior_bookmark_tab'),
            key:   'tabDragBehaviorShift',
            value: 2,
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
            value: 0,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_dropLinksOnTabBehavior_load'),
            key:   'dropLinksOnTabBehavior',
            value: 1,
            type:  'radio'
          },
          {
            title: browser.i18n.getMessage('config_dropLinksOnTabBehavior_newtab'),
            key:   'dropLinksOnTabBehavior',
            value: 2,
            type:  'radio'
          }
        ]
      }
    ]
  },
  {
    title:    browser.i18n.getMessage('config_advanced_caption') + ' / ' + browser.i18n.getMessage('config_debug_caption'),
    children: [
      {
        title: browser.i18n.getMessage('config_warnOnCloseTabs_label'),
        key:   'warnOnCloseTabs',
        type:  'checkbox'
      },
      {
        title: browser.i18n.getMessage('config_useCachedTree_label'),
        key:   'useCachedTree',
        type:  'checkbox'
      },
      { type: 'separator' },
      {
        title: browser.i18n.getMessage('config_debug_label'),
        key:   'debug',
        type:  'checkbox'
      }
    ]
  }
];

const mItemsById = new Map();
const mUpdatableItemsById = new Map();

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
  log('create: ', params);
  browser.menus.create(params);
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
    if ('checked' in params || 'title' in params) {
      browser.menus.update(item.id, params);
      updated = true;
    }
  }
  if (updated)
    browser.menus.refresh();
});

browser.menus.onClicked.addListener((info, _tab) => {
  const item = mItemsById.get(info.menuItemId);
  log('onClicked ', { id: info.menuItemId, item });
  if (!item || !item.key)
    return;

  configs[item.key] = 'value' in item ? item.value : !configs[item.key];
});
