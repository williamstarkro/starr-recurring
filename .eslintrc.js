module.exports = {
  root: true,
  env: {
    node: true,
    mocha: true
  },
  extends: 'airbnb-base',
  globals: {
    'contract': true,
    'artifacts': true,
    'assert': true,
    'web3': true
  },
  rules: {
    'arrow-body-style': 0,
    'space-before-function-paren': 'off',
    'semi': ['error', 'always', { 'omitLastInOneLineBlock': true}],
    'object-curly-newline': ['error', { 'minProperties': 6, 'consistent': true }],
    'keyword-spacing': ['error', { 'after': false, 'overrides': {
      'return': { 'after': true },
      'else': { 'after': true },
      'do': { 'after': true },
      'from': { 'after': true },
      'import': { 'after': true },
      'export': { 'after': true },
      'try': { 'after': true },
      'const': { 'after': true }
    }}],
    'max-len': ['error', { 'code': 100, 'ignorePattern': '^\\s*<path' }],
    'no-param-reassign': 0,
    'no-unused-vars': ['error', { 'varsIgnorePattern': 'ignore' }],
    'no-console': 'off',
    'no-await-in-loop': 'off',
  }
}