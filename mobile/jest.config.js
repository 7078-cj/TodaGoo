const path = require("path");

// npm installs expo-modules-core inside node_modules/expo/ (not at the top level), where the
// jest-expo preset can't find it: point Jest at that copy.
const expoModulesCore = path.dirname(
    require.resolve("expo-modules-core/package.json", { paths: [path.dirname(require.resolve("expo/package.json"))] })
);

module.exports = {
    preset: "jest-expo",
    testMatch: ["<rootDir>/__tests__/**/*.test.js"],
    setupFiles: ["<rootDir>/__tests__/setup.js"],
    // runs after Jest is installed in each file: longer waits for the screen flow tests
    setupFilesAfterEnv: ["<rootDir>/__tests__/setupAfterEnv.js"],
    // a flow test walks through many screens; slower machines (CI) need more than the default 5 s
    testTimeout: 30000,
    moduleNameMapper: {
        // illustrations (react-native-svg-transformer in metro.config.js); before "@/" so "@/assets/x.svg" matches
        "\\.svg$": "<rootDir>/__tests__/__mocks__/svgMock.js",
        // the "@/..." import alias from tsconfig.json
        "^@/(.*)$": "<rootDir>/$1",
        "^expo-modules-core$": expoModulesCore,
        "^expo-modules-core/(.*)$": `${expoModulesCore}/$1`,
    },
};
