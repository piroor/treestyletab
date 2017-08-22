/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

function getApiTabIndex(...aQueriedTabIds) {
  return new Promise((aResolve, aReject) => {
    browser.tabs.query({ currentWindow: true }).then(aTabs => {
      var tabIds = aTabs.map((aTab) => aTab.id);
      var indexes = aQueriedTabIds.map((aQueriedTabId) => tabIds.indexOf(aQueriedTabId));
      if (indexes.length == 1)
        aResolve(indexes[0]);
      else
        aResolve(indexes);
    });
  });
}
