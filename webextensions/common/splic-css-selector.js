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
  let escaped    = false;
  for (const char of selectors) {
    if (escaped) {
      soFar += char;
      escaped = false;
      continue;
    }
    if (char === '\\' && !escaped) {
      escaped = true;
      continue;
    }
    else if (char === '(') {
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
