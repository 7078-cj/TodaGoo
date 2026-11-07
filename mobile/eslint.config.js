// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  // Jest's describe / it / expect / jest in the tests and their setup
  {
    files: ['__tests__/**/*.js', 'jest.config.js'],
    languageOptions: { globals: { ...globals.jest, ...globals.node } },
    // SecureStore.__store etc.: extras of the Jest mocks (__tests__/setup.js) the checker can't see
    // expo/no-env-var-destructuring: tests and the CI reporter run in Node, nothing is inlined
    rules: { 'import/namespace': 'off', 'expo/no-env-var-destructuring': 'off' },
  },
  // run by Node (Expo CLI, EAS, Babel, Metro), not by the app
  {
    files: ['app.config.js', 'babel.config.js', 'metro.config.js', 'tailwind.config.js', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
]);
