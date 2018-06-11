/*eslint-env commonjs*/
/*eslint quote-props: ['error', "always"] */

'use strict';

module.exports = {
  'parserOptions': {
    'sourceType': 'module',
  },

  'rules': {
    'no-unused-expressions': 'error',
    'no-unused-labels': 'error',

    'no-undef': ['error', {
      'typeof': true,
    }],
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
  },
};
