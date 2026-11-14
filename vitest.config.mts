import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { "@": path.resolve(root, "src") } },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    coverage: { reporter: ["text", "json-summary", "html"] }
  }
});
