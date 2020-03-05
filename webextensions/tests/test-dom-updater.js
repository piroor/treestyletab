/*
 license: The MIT License, Copyright (c) 2020 YUKI "Piro" Hiroshi
 original:
   https://github.com/piroor/treestyletab/blob/master/webextensions/tests/test-dom-updater.js
 for:
   https://github.com/piroor/treestyletab/blob/master/webextensions/common/dom-updater.js
*/
'use strict';

import { is /*, ok, ng*/ } from '/tests/assert.js';

import * as DOMUpdater from '/common/dom-updater.js';

function createNode(source) {
  const node = document.createElement('div');
  node.innerHTML = source.trim();
  return node;
}

function assertUpdated(from, to, steps) {
  const expected = createNode(to.innerHTML);
  const actualSteps = DOMUpdater.update(from, to);
  is(expected.innerHTML, from.innerHTML);
  if (typeof steps == 'number')
    is(steps, actualSteps);
}

export function testUpdateAttributes() {
  assertUpdated(
    createNode(`
      <span class="class1 class2">contents</span>
    `),
    createNode(`
      <span class="class1 class2 class3">contents</span>
    `),
    1
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
    `),
    4 /* deletion */ + 4 /* insertion */
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
    `),
    4 /* item deletion */ + 4 /* iteminsertion */ +
      1 /* remove attr */ + 1 /* replace text */ +
      1 /* remove attr */ + 1 /* replace text */
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

