import { defineConfig, configDefaults } from "vitest/config";
import path from "path";
import { readFileSync } from "fs";

// Load .env.local for integration tests (DATABASE_URL, SESSION_SECRET, etc.)
try {
  const envFile = readFileSync(path.resolve(__dirname, ".env.local"), "utf8");
  for (const line of envFile.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    if (key && !process.env[key]) process.env[key] = val;
  }
} catch { /* no .env.local — CI will set env vars directly */ }

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    exclude: [
      ...configDefaults.exclude,
      // tests/verification/* hit the real OpenAlex / ROR / ORCID / Crossref APIs
      // with no mocking — they're non-hermetic by design and fail on CI runners
      // that can't reach those endpoints. Run them locally (where network works);
      // skip on CI (GitHub sets CI=true). Follow-up: add hermetic, fetch-mocked
      // coverage of the trust engine so CI exercises that logic too.
      ...(process.env.CI ? ["tests/verification/**"] : []),
    ],
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts"],
      reporter: ["text", "json-summary"],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
