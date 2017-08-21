/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

function getApiTabIndex(...aTabIds) {
  return new Promise((aResolve, aReject) => {
    chrome.tabs.query({ currentWindow: true }, (aTabs) => {
      var indexes = new Array(aTabIds.length);
      var found = 0;
      for (let i = 0, maxi = aTabs.length; i < maxi; i++) {
        let matched = aTabIds.indexOf(aTabs[i].id);
        if (matched > -1) {
          indexes[matched] = i;
          found++;
        }
        if (found >= aTabIds.length)
          break;
      }
      indexes = indexes.map((aIndex) => aIndex === undefined ? -1 : aIndex);
      if (indexes.length == 1)
        aResolve(indexes[0]);
      else
        aResolve(indexes);
    });
  });
}
