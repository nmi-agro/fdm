import { defineConfig } from "tsdown"
import {
  CALCULATOR_VERSION_PLACEHOLDER,
  getCalculatorVersionReplacement,
} from "./calculator-version.mjs"

// Version with a hash of the source, so that cached calculations of older code are not reused
const replacement = getCalculatorVersionReplacement()

export default defineConfig({
  entry: {
    index: "src/index.ts",
    // Browser-safe subpath without fdm-core or network dependencies, for client-side code: the
    // pure norms, nitrogen balance, dose, nutrient advice and indicator functions.
    browser: "src/browser.ts",
  },
  format: "esm",
  outDir: "dist",
  tsconfig: "./tsconfig.build.json",
  dts: true,
  sourcemap: true,
  target: "node24",
  clean: true,
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  plugins: [
    {
      name: "replace-calculator-version",
      renderChunk(code) {
        if (!code.includes(CALCULATOR_VERSION_PLACEHOLDER)) {
          return null
        }
        return {
          code: code.replace(CALCULATOR_VERSION_PLACEHOLDER, replacement),
          map: null,
        }
      },
    },
  ],
})
