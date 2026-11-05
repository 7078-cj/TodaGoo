// Runs before each test file, after Jest is set up (jest.config.js → setupFilesAfterEnv).
// waitFor / findBy* give up after 1 s by default. A busy machine (a GitHub runner, or one also
// running the backend tests) can take longer to render a screen after a request, and the screen
// flow tests failed for that reason alone. 5 s still fails fast on a real bug.
const { configure } = require("@testing-library/react-native");

configure({ asyncUtilTimeout: 5000 });
