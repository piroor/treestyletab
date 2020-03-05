/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import { is /*, ok, ng*/ } from '/tests/assert.js';

import * as DOMUpdater from '/common/dom-updater.js';

function createNode(source) {
  const node = document.createElement('div');
  node.innerHTML = source.trim();
  return node;
}

function assertUpdated(from, to) {
  const expected = createNode(to.innerHTML);
  DOMUpdater.update(from, to);
  is(expected.innerHTML, from.innerHTML);
}

export function testUpdateAttributes() {
  assertUpdated(
    createNode(`
      <span class="class1 class2">contents</span>
    `),
    createNode(`
      <span class="class1 class2 class3">contents</span>
    `)
  );
}

export function testUpdateNodes() {
  assertUpdated(
    createNode(`
      <span anonid="item1">contents</span>
      <span anonid="item2">contents</span>
      <span anonid="item3">contents</span>
      <span anonid="item4">contents</span>
      <span anonid="item5">contents</span>
      <span anonid="item6">contents</span>
    `),
    createNode(`
      <span anonid="item3">contents</span>
      <span anonid="item4">contents</span>
      <span anonid="item5">contents</span>
      <span anonid="item6">contents</span>
      <span anonid="item7">contents</span>
      <span anonid="item8">contents</span>
    `)
  );
}

export function testUpdateNodesAndAttributes() {
  assertUpdated(
    createNode(`
      <span anonid="item1">contents</span>
      <span anonid="item2">contents</span>
      <span anonid="item3" part="active">contents, active</span>
      <span anonid="item4">contents</span>
      <span anonid="item5">contents</span>
      <span anonid="item6">contents</span>
    `),
    createNode(`
      <span anonid="item3">contents, old active</span>
      <span anonid="item4">contents</span>
      <span anonid="item5">contents</span>
      <span anonid="item6" part="active">contents, new active</span>
      <span anonid="item7">contents</span>
      <span anonid="item8">contents</span>
    `)
  );
}

export function testUpdateNoHint() {
  assertUpdated(
    createNode(`
      <span>contents 1</span>
      <span>contents 2</span>
      <span part="active">contents 3, active</span>
      <span>contents 4</span>
      <span>contents 5</span>
      <span>contents 6</span>
    `),
    createNode(`
      <span>contents 3, old active</span>
      <span>contents 4</span>
      <span>contents 5</span>
      <span part="active">contents 6, new active</span>
      <span>contents 7</span>
      <span>contents 8</span>
    `)
  );
}

