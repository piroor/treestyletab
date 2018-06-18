/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

// XPath utilities

export function hasClass(className) {
  return `contains(concat(" ", normalize-space(@class), " "), " ${className} ")`;
}

export function evaluate(aExpression, aContext, type) {
  if (!type)
    type = XPathResult.ORDERED_NODE_SNAPSHOT_TYPE;

  let result;
  try {
    result = (aContext.ownerDocument || aContext).evaluate(
      aExpression,
      (aContext || document),
      null,
      type,
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
