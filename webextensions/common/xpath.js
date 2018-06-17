/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

// XPath utilities

export function hasClass(aClassName) {
  return `contains(concat(" ", normalize-space(@class), " "), " ${aClassName} ")`;
}

export function evaluate(aExpression, aContext, aType) {
  if (!aType)
    aType = XPathResult.ORDERED_NODE_SNAPSHOT_TYPE;
  try {
    var result = (aContext.ownerDocument || aContext).evaluate(
      aExpression,
      (aContext || document),
      null,
      aType,
      null
    );
  }
  catch(_exception) {
    return {
      singleNodeValue: null,
      snapshotLength:  0,
      snapshotItem:    function() {
        return null
      }
    };
  }
  return result;
}
