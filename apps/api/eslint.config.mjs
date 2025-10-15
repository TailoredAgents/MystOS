import mystNext from "@myst-os/config/eslint/next";

export default [
  ...mystNext,
  {
    files: ["**/*.mjs"],
    languageOptions: {
      parserOptions: {
        project: undefined
      }
    }
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "**/*.mjs",
      "**/*.cjs"
    ]
  }
];
