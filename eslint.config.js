import js from "@eslint/js";
import prettier from "eslint-config-prettier/flat";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Generated files and installed dependencies are outside the linting scope.
  { ignores: ["dist/**", "node_modules/**", ".husky/_/**"] },
  {
    files: ["**/*.{js,ts}"],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["**/*.ts"],
    extends: [tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  // Prettier owns formatting; disable conflicting ESLint style rules.
  prettier,
);
