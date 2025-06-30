module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: {
    node: true,
    browser: true,
  },
  rules: {
    // Enforce consistent indentation
    indent: ['error', 2, { SwitchCase: 1 }],

    // Enforce consistent use of semicolons
    semi: ['error', 'always'],

    // Enforce consistent use of quotes
    quotes: ['error', 'single', { avoidEscape: true }],

    // Enforce consistent spacing inside braces
    'object-curly-spacing': ['error', 'always'],

    // Enforce consistent spacing before function parentheses
    'space-before-function-paren': [
      'error',
      {
        anonymous: 'always',
        named: 'never',
        asyncArrow: 'always',
      },
    ],

    // Enforce consistent spacing before blocks
    'space-before-blocks': ['error', 'always'],

    // Enforce consistent spacing inside brackets
    'array-bracket-spacing': ['error', 'never'],

    // Enforce consistent spacing inside parentheses
    'space-in-parens': ['error', 'never'],

    // Enforce consistent spacing around commas
    'comma-spacing': ['error', { before: false, after: true }],

    // Enforce consistent spacing around keywords
    'keyword-spacing': ['error', { before: true, after: true }],

    // Enforce consistent spacing around infix operators
    'space-infix-ops': 'error',

    // Enforce consistent spacing before and after unary operators
    'space-unary-ops': ['error', { words: true, nonwords: false }],

    // Enforce consistent spacing around colons
    'key-spacing': ['error', { beforeColon: false, afterColon: true }],

    // Enforce consistent spacing before and after arrow functions
    'arrow-spacing': ['error', { before: true, after: true }],

    // Enforce consistent spacing around comments
    'spaced-comment': ['error', 'always', { exceptions: ['-', '+', '*'] }],

    // Enforce consistent line breaks
    'linebreak-style': ['error', 'unix'],

    // Enforce consistent brace style
    'brace-style': ['error', '1tbs', { allowSingleLine: true }],

    // Enforce consistent comma style
    'comma-style': ['error', 'last'],

    // Enforce consistent dot notation
    'dot-notation': 'error',

    // Enforce consistent eqeqeq
    eqeqeq: ['error', 'always', { null: 'ignore' }],

    // Enforce consistent no-var
    'no-var': 'error',

    // Enforce consistent prefer-const
    'prefer-const': 'error',

    // Allow all console commands in ts files
    'no-console': 'off',

    // TypeScript specific rules
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
  },
};
