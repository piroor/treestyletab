/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
/*eslint-env commonjs*/
/*eslint quote-props: ['error', "always"] */

module.exports = {
  'root': true,

  'parserOptions': {
    'ecmaVersion': 2017,
  },

  'env': {
    'browser': true,
    'es6': true,
    'webextensions': true,
  },

  'rules': {
    // stylisitc problem
    'indent': ['warn', 2, {
      'SwitchCase': 1,
      'MemberExpression': 1,
      'CallExpression': {
        'arguments': 'first',
      },
      'VariableDeclarator': {
        'var': 2,
        'let': 2,
        'const': 3,
      }
    }],
    'quotes': ['warn', 'single', {
      'avoidEscape': true,
      'allowTemplateLiterals': true,
    }],
  }
};
