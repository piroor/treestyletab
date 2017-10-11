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
