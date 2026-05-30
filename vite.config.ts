import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Tauri-tuned Vite config. See https://v2.tauri.app/start/frontend/vite/
const host = process.env.TAURI_DEV_HOST

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Tauri expects a fixed port and its own console output.
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: {
      // Don't watch the Rust side from Vite.
      ignored: ['**/src-tauri/**', '**/core/**'],
    },
  },
  // Env vars starting with these prefixes are exposed to the client.
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    // Tauri ships modern webviews (webkit2gtk on Linux, WebView2 on Windows,
    // recent WKWebView on macOS), so a modern target is safe — and esbuild
    // cannot downlevel destructuring to the very old `safari13` default.
    target:
      process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'es2022',
    minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
  // Vitest: jsdom for component tests, jest-dom matchers via the setup file.
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
