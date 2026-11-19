
const { parseProjectEnv } = require("@expo/env");
const path = require("path");

const { env } = parseProjectEnv(__dirname, {
  mode: "production",
  silent: true,
});

console.log("Production environment verification:");

for (const key of [
  "EXPO_PUBLIC_API_URL",
  "EXPO_PUBLIC_WS_URL",
  "EXPO_PUBLIC_ORS_API_KEY",
]) {
  const value = env[key];

  if (!value) {
    console.log(`${key}: MISSING`);
    continue;
  }

  if (key.includes("API_URL") || key.includes("WS_URL")) {
    console.log(`${key}: ${value}`);
  } else {
    console.log(`${key}: ${value.length > 0 ? "CONFIGURED" : "EMPTY"}`);
  }
}
