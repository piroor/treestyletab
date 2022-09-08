/*
  Original: https://github.com/joakimbeng/split-css-selector
  MIT License © Joakim Carlstein
*/

'use strict';

export function split(selectors) {
  if (isAtRule(selectors)) {
    return [selectors];
  }
  const splitted = [];
  let parens     = 0;
  let angulars   = 0;
  let soFar      = '';
  for (const char of selectors) {
    if (char === '(') {
      parens++;
    }
    else if (char === ')') {
      parens--;
    }
    else if (char === '[') {
      angulars++;
    }
    else if (char === ']') {
      angulars--;
    }
    else if (char === ',') {
      if (!parens && !angulars) {
        splitted.push(soFar.trim());
        soFar = '';
        continue;
      }
    }
    soFar += char;
  }
  splitted.push(soFar.trim());
  return splitted;
}

function isAtRule(selector) {
  return selector.startsWith('@');
}
