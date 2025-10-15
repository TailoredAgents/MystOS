const { FlatCompat } = require("@eslint/eslintrc");
const js = require("@eslint/js");
const path = require("node:path");

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

const baseConfigs = compat.config(require(path.join(__dirname, "./base.cjs")));

module.exports = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  ...baseConfigs,
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: process.cwd()
      }
    },
    rules: {
      "react/jsx-props-no-spreading": "off"
    }
  }
];

