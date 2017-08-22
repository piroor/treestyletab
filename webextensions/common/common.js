/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

var configs;

function log(aMessage, ...aArgs)
{
  if (!configs || !configs.debug)
    return;

  var nest = (new Error()).stack.split('\n').length;
  var indent = '';
  for (let i = 0; i < nest; i++) {
    indent += ' ';
  }
  console.log(`treestyletab: ${indent}${aMessage}`, ...aArgs);
}

function dumpTab(aTab) {
  return `@${getTabIndex(aTab)}#${aTab.id}, title=${JSON.stringify(aTab.textContent)}`;
}

configs = new Configs({
  treeStructure: [],

  animation: true,
  debug:     false
});
