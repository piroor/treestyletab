/*eslint-env commonjs*/
/*eslint quote-props: ['error', "always"] */

module.exports = {
  'root': true,

  'parserOptions': {
    'ecmaVersion': 2017,
  },

  'env': {
    'webextensions': true,
  },

  'rules': {
    // stylisitc problem
    'quotes': ['warn', 'single', {
      'avoidEscape': true,
      'allowTemplateLiterals': true,
    }],
  }
};
