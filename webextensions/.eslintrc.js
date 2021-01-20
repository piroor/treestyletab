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
    'ecmaVersion': 2020,
  },

  'env': {
    'browser': true,
    'es6': true,
    'webextensions': true,
  },

  'settings': {
    'import/resolver': {
      'babel-module': {
        'root': ['./'],
      }
    }
  },

  'rules': {
    'no-const-assign': 'error',
    'prefer-const': ['warn', {
      'destructuring': 'any',
      'ignoreReadBeforeAssign': false
    }],
    'no-var': 'error',
    'no-unused-vars': ['warn', { // Not make an error for debugging.
      'vars': 'all',
      'args': 'after-used',
      'argsIgnorePattern': '^_',
      'caughtErrors': 'all',
      'caughtErrorsIgnorePattern': '^_', // Allow `catch (_e) {...}`
    }],
    'no-use-before-define': ['error', { // the measure for Temporary Dead Zone
      'functions': false, //  Function declarations are hoisted.
      'classes': true, // Class declarations are not hoisted. We should warn it.
    }],
    'no-unused-expressions': 'error',
    'no-unused-labels': 'error',
    'no-undef': ['error', {
      'typeof': true,
    }],

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
    'no-underscore-dangle': ['warn', { // Ban the name which starts with `_`.
      'allowAfterThis': true, // allow after this to create a private member.
    }],
    'quotes': ['warn', 'single', {
      'avoidEscape': true,
      'allowTemplateLiterals': true,
    }],
  }
};
