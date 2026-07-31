import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import jsdoc from "eslint-plugin-jsdoc";
import jsxA11y from "eslint-plugin-jsx-a11y";
import { configs as tseslintConfigs } from "typescript-eslint";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Stricter type-aware TypeScript linting than eslint-config-next's
  // baseline recommended set - this is the concrete lever for
  // "strict coding standards" (see CODING_STANDARDS.md).
  ...tseslintConfigs.strictTypeChecked,
  ...tseslintConfigs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // Root-level *.config.mjs files (this file, postcss.config.mjs) and
        // one-off dev scripts under scripts/ (e.g.
        // scrape-quest-guide-images.mjs - a developer-run tool, not part of
        // the app build) aren't part of tsconfig.json's `include` and don't
        // need type-aware linting - fall back to a default (untyped)
        // project for them instead of erroring.
        projectService: {
          allowDefaultProject: ["*.config.mjs", "scripts/*.mjs"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // Files linted under allowDefaultProject above have no full type
  // information available, so the type-checked rule set must be turned
  // back off for them specifically (recommended pairing per
  // typescript-eslint docs).
  {
    files: ["*.config.mjs", "scripts/*.mjs"],
    extends: [tseslintConfigs.disableTypeChecked],
  },
  // Accessibility - the legacy sites had zero a11y consideration
  // (inline onclick handlers, no ARIA), enforcing now
  //
  // eslint-config-next already registers the "jsx-a11y" and "import"
  // plugin instances, so only the *rules* from these presets are
  // applied here (re-registering the same plugin object throws a
  // "Cannot redefine plugin" ConfigError).
  {
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // `Checkbox` (src/shared/ui/checkbox/Checkbox.tsx) wraps a real
      // `<input type="checkbox">` behind a custom-styled overlay - the rule
      // can't see through a custom component to find it, so tell it about
      // the wrapper explicitly rather than disabling the check.
      "jsx-a11y/label-has-associated-control": ["error", { controlComponents: ["Checkbox"] }],
    },
  },
  // Consistent import grouping/ordering across the codebase.
  {
    rules: {
      ...importPlugin.flatConfigs.recommended.rules,
      ...importPlugin.flatConfigs.typescript.rules,
    },
  },
  {
    settings: importPlugin.flatConfigs.typescript.settings,
    rules: {
      "import/order": [
        "warn",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index", "type"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      // TypeScript already checks unresolved imports/module resolution;
      // import/no-unresolved duplicates that work and false-positives on
      // path aliases and Next.js's own module resolution.
      "import/no-unresolved": "off",
    },
  },
  // Require TSDoc-style comments on exported symbols only (not every
  // internal helper) to avoid comment noise while still documenting the
  // public surface of each module.
  {
    plugins: { jsdoc },
    rules: {
      "jsdoc/require-jsdoc": [
        "warn",
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            MethodDefinition: false,
            ClassDeclaration: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
          },
        },
      ],
    },
  },
  // Must be last: turns off any stylistic ESLint rules that would
  // otherwise conflict with Prettier's formatting output.
  prettierConfig,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Legacy reference-only projects - not linted as part of this project.
    "old/**",
  ]),
]);

export default eslintConfig;
