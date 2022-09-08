/*
  Original: https://github.com/joakimbeng/split-css-selector
  MIT License © Joakim Carlstein
*/

'use strict';

export function split(selectors) {
  if (isAtRule(selectors))
    return [selectors];

  const splitted = [];
  let parens     = 0;
  let angulars   = 0;
  let soFar      = '';
  let escaped    = false;
  let singleQuoted = false;
  let doubleQuoted = false;
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
    if (char === "'") {
      if (singleQuoted)
        singleQuoted = false;
      else if (!doubleQuoted)
        singleQuoted = true;
    }
    else if (char === '"') {
      if (doubleQuoted)
        doubleQuoted = false;
      else if (!singleQuoted)
        doubleQuoted = true;
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
      if (!parens &&
          !angulars &&
          !singleQuoted &&
          !doubleQuoted) {
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
