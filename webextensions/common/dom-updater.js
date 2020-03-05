/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger
} from './common.js';
import { SequenceMatcher } from './diff.js';

function log(...args) {
  internalLogger('common/dom-updater', ...args);
}

export function update(before, after) {
  if (before.nodeValue !== null ||
      after.nodeValue !== null) {
    if (before.nodeValue != after.nodeValue) {
      log('node value: ', after.nodeValue);
      before.nodeValue = after.nodeValue;
    }
    return;
  }

  const beforeNodes = Array.from(before.childNodes, getDiffableNodeString);
  const afterNodes = Array.from(after.childNodes, getDiffableNodeString);
  const nodeOerations = (new SequenceMatcher(beforeNodes, afterNodes)).operations();
  let nodeOffset = 0;
  for (const operation of nodeOerations) {
    const [tag, fromStart, fromEnd, toStart, toEnd] = operation;
    switch (tag) {
      case 'equal':
        for (let i = 0, maxi = fromEnd - fromStart; i < maxi; i++) {
          update(
            before.childNodes[fromStart + i + nodeOffset],
            after.childNodes[toStart + i]
          );
        }
        break;
      case 'delete':
        for (let i = fromEnd - 1; i >= fromStart; i--) {
          log('delete: delete node: ', before.childNodes[i + nodeOffset]);
          before.removeChild(before.childNodes[i + nodeOffset]);
        }
        break;
      case 'insert':
        for (let i = toStart; i < toEnd; i++) {
          log('insert: insert node: ', after.childNodes[i]);
          before.insertBefore(
            after.childNodes[i].cloneNode(true),
            before.hasChildNodes() && before.childNodes[fromStart + nodeOffset] || null
          );
          nodeOffset++;
        }
        break;
      case 'replace':
        for (let i = fromEnd - 1; i >= fromStart; i--) {
          log('replace: delete node: ', before.childNodes[i + nodeOffset]);
          before.removeChild(before.childNodes[i + nodeOffset]);
        }
        for (let i = toStart; i < toEnd; i++) {
          log('replace: insert node: ', after.childNodes[i]);
          before.insertBefore(
            after.childNodes[i].cloneNode(true),
            before.hasChildNodes() && before.childNodes[fromStart + nodeOffset] || null
          );
          nodeOffset++;
        }
        break;
    }
  }

  if (before.nodeType == Node.ELEMENT_NODE &&
      after.nodeType == Node.ELEMENT_NODE) {
    const beforeAttrs = Array.from(before.attributes, attr => `${attr.name}:${attr.value}`).sort();
    const afterAttrs = Array.from(after.attributes, attr => `${attr.name}:${attr.value}`).sort();
    const attrOerations = (new SequenceMatcher(beforeAttrs, afterAttrs)).operations();
    for (const operation of attrOerations) {
      const [tag, fromStart, fromEnd, toStart, toEnd] = operation;
      switch (tag) {
        case 'equal':
          break;
        case 'delete':
          for (let i = fromStart; i < fromEnd; i++) {
            const name = beforeAttrs[i].split(':')[0];
            log('delete: delete attr: ', name);
            before.removeAttribute(name);
          }
          break;
        case 'insert':
          for (let i = toStart; i < toEnd; i++) {
            const attr = afterAttrs[i].split(':');
            const name = attr[0];
            const value = attr.slice(1).join(':');
            log('insert: set attr: ', name, value);
            before.setAttribute(name, value);
          }
          break;
        case 'replace':
          const insertedAttrs = new Set();
          for (let i = toStart; i < toEnd; i++) {
            const attr = afterAttrs[i].split(':');
            const name = attr[0];
            const value = attr.slice(1).join(':');
            log('replace: set attr: ', name, value);
            before.setAttribute(name, value);
            insertedAttrs.add(name);
          }
          for (let i = fromStart; i < fromEnd; i++) {
            const name = beforeAttrs[i].split(':')[0];
            if (insertedAttrs.has(name))
              continue;
            log('replace: delete attr: ', name);
            before.removeAttribute(name);
          }
          break;
      }
    }
  }
  //log(' => ', configs.debug && before.innerHTML);
}

function getDiffableNodeString(node) {
  if (node.nodeType == Node.ELEMENT_NODE)
    return `element:${node.tagName}#${node.id}#${node.getAttribute('anonid')}`;
  else
    return `node:${node.nodeType}`;
}
