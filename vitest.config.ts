import { defineConfig } from 'vitest/config'

// Standalone vitest config. The app is not a Vite project — vitest is the
// allowed test runner (per `lite-spec`'s citation grammar) and uses Vite only
// internally to transform sources. No Vite-as-bundler is wired into `dev`/
// `build`, so P-3 ("MUST NOT use Vite or another browser bundler") holds.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
