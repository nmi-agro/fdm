import { cpSync, mkdirSync } from "node:fs"
import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  outDir: "dist",
  dts: true,
  sourcemap: true,
  target: "node24",
  clean: true,
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  plugins: [
    {
      name: "copy-migrations-folder",
      buildEnd() {
        try {
          mkdirSync("dist/db/migrations", { recursive: true })
          cpSync("src/db/migrations", "dist/db/migrations", {
            recursive: true,
          })
          console.log("Copied migrations folder to dist/db/migrations")
        } catch (err) {
          console.error("Error copying migrations folder:", err)
          throw err
        }
      },
    },
  ],
})
