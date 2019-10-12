/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

export function generateThemeRules(theme) {
  const rules = [];
  const generateCustomRule = (theme, prefix = '') => {
    for (const key of Object.keys(theme)) {
      if (!theme[key])
        continue;
      const propertyKey = prefix ? `${prefix}-${key}` : key;
      let value = theme[key];
      switch (typeof theme[key]) {
        case 'object':
          generateCustomRule(value, propertyKey);
          break;
        case 'string':
          if (/^[^:]+:\/\//.test(value))
            value = `url(${JSON.stringify(value)})`;
          rules.push(`--theme-${propertyKey}: ${value};`);
          break;
      }
    }
  };
  generateCustomRule(theme);
  return rules.join('\n');
}
