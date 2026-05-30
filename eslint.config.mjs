import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./lib/core",
              from: "./lib/jdr",
              message:
                "lib/core ne doit pas dépendre de lib/jdr (PC-H3 / CONVENTIONS.md).",
            },
            {
              target: "./lib/core",
              from: "./components",
              message:
                "lib/core ne doit pas dépendre de components (PC-H3 / CONVENTIONS.md).",
            },
            {
              target: "./components/common",
              from: "./lib/jdr",
              message:
                "components/common doit rester service-agnostic (PC-H6 / CONVENTIONS.md).",
            },
            {
              target: "./components/common",
              from: "./components/jdr",
              message:
                "components/common doit rester service-agnostic (PC-H6 / CONVENTIONS.md).",
            },
            {
              target: "./components/ui",
              from: "./lib/jdr",
              message:
                "components/ui (shadcn primitives) ne doit pas dépendre de lib/jdr (PC-H6 / CONVENTIONS.md).",
            },
            {
              target: "./components/ui",
              from: "./lib/core",
              message:
                "components/ui (shadcn primitives) ne doit pas dépendre de lib/core (PC-H6 / CONVENTIONS.md).",
            },
            {
              target: "./components/ui",
              from: "./components/jdr",
              message:
                "components/ui (shadcn primitives) ne doit pas dépendre de components/jdr (PC-H6 / CONVENTIONS.md).",
            },
            {
              target: "./components/ui",
              from: "./components/common",
              message:
                "components/ui (shadcn primitives) ne doit pas dépendre de components/common (PC-H6 / CONVENTIONS.md).",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
