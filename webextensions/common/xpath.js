/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

// XPath utilities

function hasClass(aClassName) {
  return `contains(concat(" ", normalize-space(@class), " "), " ${aClassName} ")`;
}

const NSResolver = {
  lookupNamespaceURI : function(aPrefix) {
    switch (aPrefix)
    {
      case 'html':
      case 'xhtml':
        return 'http://www.w3.org/1999/xhtml';
      case 'xlink':
        return 'http://www.w3.org/1999/xlink';
      default:
        return '';
    }
  }
};

function evaluateXPath(aExpression, aContext, aType) {
  if (!aType)
    aType = XPathResult.ORDERED_NODE_SNAPSHOT_TYPE;
  try {
    var result = (aContext.ownerDocument || aContext).evaluate(
      aExpression,
      (aContext || document),
      NSResolver,
      aType,
      null
    );
  }
  catch(e) {
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

function getArrayFromXPathResult(aXPathResult) {
  var max   = aXPathResult.snapshotLength;
  var array = new Array(max);
  if (!max)
    return array;

  for (var i = 0; i < max; i++) {
    array[i] = aXPathResult.snapshotItem(i);
  }
  return array;
}
