/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import * as TSTAPI from '/common/tst-api.js';

import {
  configs
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import { DOMUpdater } from '/extlib/dom-updater.js';

import {
  kTAB_ELEMENT_NAME,
} from './components/TabElement.js';

import Tab from '/common/Tab.js';

import * as EventUtils from './event-utils.js';
import * as Sidebar from './sidebar.js';

const mAddonsWithExtraContents = new Set();

const mNewTabButtonExtraItemsContainerRoots = Array.from(
  document.querySelectorAll(`.${Constants.kNEWTAB_BUTTON} .${Constants.kEXTRA_ITEMS_CONTAINER}`),
  container => {
    const root = container.attachShadow({ mode: 'open' });
    root.itemById = new Map();
    return root;
  }
);

const mTabbarTopExtraItemsContainerRoot = (() => {
  const container = document.querySelector(`#tabbar-top > .${Constants.kEXTRA_ITEMS_CONTAINER}`);
  const root = container.attachShadow({ mode: 'open' });
  root.itemById = new Map();
  return root;
})();

const mTabbarBottomExtraItemsContainerRoot = (() => {
  const container = document.querySelector(`#tabbar-bottom > .${Constants.kEXTRA_ITEMS_CONTAINER}`);
  const root = container.attachShadow({ mode: 'open' });
  root.itemById = new Map();
  return root;
})();

TSTAPI.onRegistered.addListener(addon => {
  // Install stylesheet always, even if the addon is not allowed to access
  // private windows, because the client addon can be alloed on private
  // windows by Firefox itself and extra context menu commands may be called
  // via Firefox's native context menu (or shortcuts).
  if (addon.style)
    installStyle(addon.id, addon.style);
});

TSTAPI.onUnregistered.addListener(addon => {
  clearAllExtraTabContents(addon.id);
  uninstallStyle(addon.id)
});

TSTAPI.onMessageExternal.addListener((message, sender) => {
  if ((!configs.incognitoAllowedExternalAddons.includes(sender.id) &&
       document.documentElement.classList.contains('incognito')))
    return;

  switch (message.type) {
    case TSTAPI.kCLEAR_ALL_EXTRA_TAB_CONTENTS:
      clearAllExtraTabContents(sender.id);
      return;

    case TSTAPI.kSET_EXTRA_NEW_TAB_BUTTON_CONTENTS:
      setExtraNewTabButtonContents(sender.id, message);
      return;

    case TSTAPI.kCLEAR_EXTRA_NEW_TAB_BUTTON_CONTENTS:
      clearExtraNewTabButtonContents(sender.id);
      return;

    case TSTAPI.kSET_EXTRA_TABBAR_TOP_CONTENTS:
      setExtraTabbarTopContents(sender.id, message);
      return;

    case TSTAPI.kCLEAR_EXTRA_TABBAR_TOP_CONTENTS:
      clearExtraTabbarTopContents(sender.id);
      return;

    case TSTAPI.kSET_EXTRA_TABBAR_BOTTOM_CONTENTS:
      setExtraTabbarBottomContents(sender.id, message);
      return;

    case TSTAPI.kCLEAR_EXTRA_TABBAR_BOTTOM_CONTENTS:
      clearExtraTabbarBottomContents(sender.id);
      return;

    default:
      Tab.waitUntilTracked(message.id, { element: true }).then(() => {
        const tabElement = document.querySelector(`#tab-${message.id}`);
        if (!tabElement)
          return;

        switch (message.type) {
          case TSTAPI.kSET_EXTRA_TAB_CONTENTS:
            setExtraTabContents(tabElement, sender.id, message);
            break;

          case TSTAPI.kCLEAR_EXTRA_TAB_CONTENTS:
            clearExtraTabContents(tabElement, sender.id);
            break;
        }
      });
      break;
  }
});

// https://developer.mozilla.org/docs/Web/HTML/Element
const SAFE_CONTENTS = `
a
abbr
acronym
address
//applet
area
article
aside
b
//base
//basefont
bdi
bdo
//bgsound
big
blink
blockquote
//body
br
button
canvas
caption
center
cite
code
col
colgroup
command
//content
data
datalist
dd
del
details
dfn
dialog
dir
div
dl
dt
//element
em
//embed
fieldset
figcaption
figure
font
footer
//form
//frame
//frameset
h1
//head
header
hgroup
hr
//html
i
//iframe
image
img
input
ins
isindex
kbd
keygen
label
legend
li
//link
listing
main
map
mark
marquee
menu
menuitem
//meta
//meter
multicol
nav
nextid
nobr
//noembed
//noframes
//noscript
object
ol
optgroup
option
output
p
param
picture
plaintext
pre
progress
q
rb
rp
rt
rtc
duby
s
samp
//script
section
select
//shadow
slot
small
source
spacer
span
strike
strong
//style
sub
summary
sup
table
tbody
td
template
textarea
tfoot
th
thead
time
//title
tr
track
tt
u
ul
var
//video
wbr
xmp
`.trim().split('\n').filter(selector => !selector.startsWith('//'));
const DANGEROUS_CONTENTS_SELECTOR = SAFE_CONTENTS.map(selector => `:not(${selector})`).join('');

function setExtraContents(container, id, params = {}) {

  let item = container.itemById.get(id);
  if (!params.style &&
      item &&
      item.styleElement &&
      item.styleElement.parentNode) {
    container.removeChild(item.styleElement);
    item.styleElement = null;
  }
  if (!params.contents) {
    if (item) {
      if (item.styleElement)
        container.removeChild(item.styleElement);
      container.removeChild(item);
      container.itemById.delete(id);
    }
    return;
  }

  const extraContentsPartName = getExtraContentsPartName(id);

  if (!item) {
    item = document.createElement('span');
    item.setAttribute('part', `${extraContentsPartName} container`);
    item.classList.add('extra-item');
    item.classList.add(extraContentsPartName);
    item.dataset.owner = id;
    container.itemById.set(id, item);
  }
  if ('style' in params && !item.styleElement) {
    const style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    item.styleElement = style;
  }

  const range = document.createRange();
  range.selectNodeContents(item);
  const contents = range.createContextualFragment(String(params.contents || '').trim());
  range.detach();

  const dangerousContents = contents.querySelectorAll(DANGEROUS_CONTENTS_SELECTOR);
  for (const node of dangerousContents) {
    node.parentNode.removeChild(node);
  }
  if (dangerousContents.length > 0)
    console.log(`Could not include some elements as extra contents. provider=${id}, container:`, container, dangerousContents);

  // Sanitize remote resources
  for (const node of contents.querySelectorAll('*[href], *[src], *[srcset], *[part]')) {
    for (const attribute of node.attributes) {
      if (attribute.name == 'part')
        attribute.value += ` ${extraContentsPartName}`;
      if (/^(href|src|srcset)$/.test(attribute.name) &&
          attribute.value &&
          !/^(data|resource|chrome|about|moz-extension):/.test(attribute.value)) {
        attribute.value = '#';
        node.setAttribute('part', `${node.getAttribute('part') || ''} sanitized`);
      }
    }
  }
  // We don't need to handle inline event handlers because
  // they are blocked by the CSP mechanism.

  if ('style' in params)
    item.styleElement.textContent = (params.style || '')
      .replace(/%EXTRA_CONTENTS_PART%/gi, `${extraContentsPartName}`);

  DOMUpdater.update(item, contents);

  if (item.styleElement &&
      !item.styleElement.parentNode)
    container.appendChild(item.styleElement);
  if (!item.parentNode)
    container.appendChild(item);

  mAddonsWithExtraContents.add(id);
}

function getExtraContentsPartName(id) {
  return `extra-contents-by-${id.replace(/[^-a-z0-9_]/g, '_')}`;
}


function setExtraTabContents(tabElement, id, params = {}) {
  let container;
  switch (String(params.place).toLowerCase()) {
    case 'indent':
      container = tabElement.extraItemsContainerIndentRoot;
      break;

    case 'behind':
      container = tabElement.extraItemsContainerBehindRoot;
      break;

    case 'front':
    default:
      container = tabElement.extraItemsContainerFrontRoot;
      break;
  }

  if (container)
    return setExtraContents(container, id, params);
}

function clearExtraTabContents(tabElement, id) {
  setExtraTabContents(tabElement, id, { place: 'indent' });
  setExtraTabContents(tabElement, id, { place: 'front' });
  setExtraTabContents(tabElement, id, { place: 'behind' });
}

function clearAllExtraTabContents(id) {
  if (!mAddonsWithExtraContents.has(id))
    return;

  for (const tabElement of document.querySelectorAll(kTAB_ELEMENT_NAME)) {
    clearExtraTabContents(tabElement, id);
  }
  setExtraNewTabButtonContents(id);
  clearExtraTabbarTopContents(id);
  clearExtraTabbarBottomContents(id);
  mAddonsWithExtraContents.delete(id);
}


function setExtraNewTabButtonContents(id, params = {}) {
  for (const container of mNewTabButtonExtraItemsContainerRoots) {
    setExtraContents(container, id, params);
  }
  Sidebar.reserveToUpdateTabbarLayout({
    reason:  Constants.kTABBAR_UPDATE_REASON_RESIZE,
    timeout: 100,
  });
}

function clearExtraNewTabButtonContents(id) {
  setExtraNewTabButtonContents(id, {});
}


function setExtraTabbarTopContents(id, params = {}) {
  setExtraContents(mTabbarTopExtraItemsContainerRoot, id, params);
  Sidebar.reserveToUpdateTabbarLayout({
    reason:  Constants.kTABBAR_UPDATE_REASON_RESIZE,
    timeout: 100,
  });
}

function clearExtraTabbarTopContents(id) {
  setExtraTabbarTopContents(id, {});
}


function setExtraTabbarBottomContents(id, params = {}) {
  setExtraContents(mTabbarBottomExtraItemsContainerRoot, id, params);
  Sidebar.reserveToUpdateTabbarLayout({
    reason:  Constants.kTABBAR_UPDATE_REASON_RESIZE,
    timeout: 100,
  });
}

function clearExtraTabbarBottomContents(id) {
  setExtraTabbarBottomContents(id, {});
}


const mAddonStyles = new Map();

function installStyle(id, style) {
  let styleElement = mAddonStyles.get(id);
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.setAttribute('type', 'text/css');
    document.head.insertBefore(styleElement, document.querySelector('#addons-style-rules'));
    mAddonStyles.set(id, styleElement);
  }
  styleElement.textContent = (style || '').replace(/%EXTRA_CONTENTS_PART%/gi, getExtraContentsPartName(id));
}

function uninstallStyle(id) {
  const styleElement = mAddonStyles.get(id);
  if (!styleElement)
    return;
  document.head.removeChild(styleElement);
  mAddonStyles.delete(id);
}


// we should not handle dblclick on #tabbar here - it is handled by mouse-event-listener.js
for (const container of document.querySelectorAll('#tabbar-top, #tabbar-bottom')) {
  container.addEventListener('dblclick', onExtraContentsDblClick, { capture: true });
}
document.addEventListener('keydown',  onExtraContentsKeyEvent, { capture: true });
document.addEventListener('keyup',    onExtraContentsKeyEvent, { capture: true });
document.addEventListener('input',    onExtraContentsInput,    { capture: true });
document.addEventListener('change',   onExtraContentsChange,   { capture: true });
document.addEventListener('compositionstart',  onExtraContentsCompositionEvent, { capture: true });
document.addEventListener('compositionupdate', onExtraContentsCompositionEvent, { capture: true });
document.addEventListener('compositionend',    onExtraContentsCompositionEvent, { capture: true });
document.addEventListener('focus',    onExtraContentsFocusEvent, { capture: true });
document.addEventListener('blur',     onExtraContentsFocusEvent, { capture: true });

async function onExtraContentsDblClick(event) {
  const detail            = EventUtils.getMouseEventDetail(event, null);
  const extraContentsInfo = getOriginalExtraContentsTarget(event);
  const allowed = await tryMouseOperationAllowedWithExtraContents(
    TSTAPI.kNOTIFY_EXTRA_CONTENTS_DBLCLICKED,
    null,
    { detail },
    extraContentsInfo
  );
  if (allowed)
    return;
}

async function notifyExtraContentsEvent(event, eventType, details = {}) {
  const extraContentsInfo = getOriginalExtraContentsTarget(event);
  if (!extraContentsInfo ||
      !extraContentsInfo.owners ||
      extraContentsInfo.owners.size == 0)
    return;

  const target = EventUtils.getElementOriginalTarget(event);
  if (target && target.closest('tab-item, button, input[type="submit"]')) {
    event.stopPropagation();
    event.stopImmediatePropagation();
    event.preventDefault();
  }

  const livingTab = EventUtils.getTabFromEvent(event);
  const eventInfo = {
    ...EventUtils.getTabEventDetail(event, livingTab),
    ...extraContentsInfo.fieldValues,
    originalTarget:     extraContentsInfo.target,
    $extraContentsInfo: null,
    ...details,
  };
  const options = {
    targets: extraContentsInfo.owners,
  };
  if (livingTab) {
    eventInfo.tab = new TSTAPI.TreeItem(livingTab);
    options.tabProperties = ['tab'];
  }

  await TSTAPI.tryOperationAllowed(
    eventType,
    eventInfo,
    options
  );
}

async function onExtraContentsKeyEvent(event) {
  await notifyExtraContentsEvent(
    event,
    event.type == 'keydown' ?
      TSTAPI.kNOTIFY_EXTRA_CONTENTS_KEYDOWN :
      TSTAPI.kNOTIFY_EXTRA_CONTENTS_KEYUP,
    {
      key:         event.key,
      isComposing: event.isComposing,
      locale:      event.locale,
      location:    event.location,
      repeat:      event.repeat,
    }
  );
}

async function onExtraContentsInput(event) {
  await notifyExtraContentsEvent(
    event,
    TSTAPI.kNOTIFY_EXTRA_CONTENTS_INPUT,
    {
      data:        event.data,
      inputType:   event.inputType,
      isComposing: event.isComposing,
    }
  );
}

async function onExtraContentsChange(event) {
  await notifyExtraContentsEvent(
    event,
    TSTAPI.kNOTIFY_EXTRA_CONTENTS_CHANGE
  );
}

async function onExtraContentsCompositionEvent(event) {
  await notifyExtraContentsEvent(
    event,
    event.type == 'compositionstart' ?
      TSTAPI.kNOTIFY_EXTRA_CONTENTS_COMPOSITIONSTART : 
      event.type == 'compositionupdate' ?
        TSTAPI.kNOTIFY_EXTRA_CONTENTS_COMPOSITIONUPDATE :
        TSTAPI.kNOTIFY_EXTRA_CONTENTS_COMPOSITIONEND,
    {
      data:   event.data,
      locale: event.locale,
    }
  );
}

async function onExtraContentsFocusEvent(event) {
  const target = EventUtils.getElementOriginalTarget(event);
  if (!target)
    return {};

  const extraContents = target.closest(`.extra-item`);

  let relatedTarget = null;
  const relatedTargetNode    = event.relatedTarget && EventUtils.getElementTarget(event.relatedTarget);
  const relatedExtraContents = relatedTargetNode && relatedTargetNode.closest(`.extra-item`)
  if (relatedExtraContents &&
      extraContents.dataset.owner == relatedExtraContents.dataset.owner)
    relatedTarget = relatedTargetNode.outerHTML;

  await notifyExtraContentsEvent(
    event,
    event.type == 'focus' ?
      TSTAPI.kNOTIFY_EXTRA_CONTENTS_FOCUS : 
      TSTAPI.kNOTIFY_EXTRA_CONTENTS_BLUR,
    { relatedTarget }
  );
}

function getFieldValues(event) {
  const target = EventUtils.getElementOriginalTarget(event);
  if (!target)
    return {};

  const fieldNode = target.closest('input, select, textarea');
  if (!fieldNode)
    return {};

  return {
    value:   'value' in fieldNode ? fieldNode.value : null,
    checked: 'checked' in fieldNode ? fieldNode.checked : null,
  };
}

export function getOriginalExtraContentsTarget(event) {
  try {
    const target        = EventUtils.getElementOriginalTarget(event);
    const extraContents = target && target.closest(`.extra-item`);
    if (extraContents)
      return {
        owners: new Set([extraContents.dataset.owner]),
        target: target.outerHTML,
        fieldValues: getFieldValues(event),
      };
  }
  catch(_error) {
    // this may happen by mousedown on scrollbar
  }

  return {
    owners: new Set(),
    target: null,
    fieldValues: {},
  };
}

export async function tryMouseOperationAllowedWithExtraContents(eventType, rawEventType, mousedown, extraContentsInfo) {
  if (extraContentsInfo &&
      extraContentsInfo.owners &&
      extraContentsInfo.owners.size > 0) {
    const eventInfo = {
      ...mousedown.detail,
      originalTarget:     extraContentsInfo.target,
      ...extraContentsInfo.fieldValues,
      $extraContentsInfo: null,
    };
    const options = {
      targets: extraContentsInfo.owners,
    };
    if (mousedown.treeItem) {
      eventInfo.tab = mousedown.treeItem;
      options.tabProperties = ['tab'];
    }
    const allowed = (await TSTAPI.tryOperationAllowed(
      eventType,
      eventInfo,
      options
    )) && (!rawEventType || await TSTAPI.tryOperationAllowed(
      rawEventType, // for backward compatibility
      eventInfo,
      options
    ));
    if (!allowed)
      return false;
  }

  if (rawEventType) {
    const eventInfo = {
      ...mousedown.detail,
      $extraContentsInfo: null,
    };
    const options = {
      except: extraContentsInfo && extraContentsInfo.owners,
    };
    if (mousedown.treeItem) {
      eventInfo.tab = mousedown.treeItem;
      options.tabProperties = ['tab'];
    }
    const allowed = await TSTAPI.tryOperationAllowed(
      rawEventType,
      eventInfo,
      options
    );
    if (!allowed)
      return false;
  }

  return true;
}
