/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  testMatch: ["**/?(*.)+(test|spec).ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@myst-os/pricing$": "<rootDir>/../../packages/pricing/src/index.ts",
    "^@myst-os/pricing/(.*)$": "<rootDir>/../../packages/pricing/$1"
  },
  globals: {
    "ts-jest": {
      useESM: true,
      tsconfig: "<rootDir>/tsconfig.json"
    }
  },
  moduleDirectories: ["node_modules", "<rootDir>/node_modules"]
};

module.exports = config;
