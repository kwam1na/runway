import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "**/.git/**",
      "**/node_modules/**",
      "**/.worktrees/**",
    ],
    // Harness tests mutate process.cwd(), so file-level parallelism creates cross-test races.
    fileParallelism: false,
  },
});
