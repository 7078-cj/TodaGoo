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
    moduleNameMapper: {
        // illustrations (react-native-svg-transformer in metro.config.js); before "@/" so "@/assets/x.svg" matches
        "\\.svg$": "<rootDir>/__tests__/__mocks__/svgMock.js",
        // the "@/..." import alias from tsconfig.json
        "^@/(.*)$": "<rootDir>/$1",
        "^expo-modules-core$": expoModulesCore,
        "^expo-modules-core/(.*)$": `${expoModulesCore}/$1`,
    },
};
