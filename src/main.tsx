/**
 * OpenTUI entry point for skill-cellar.
 *
 * The application substrate is OpenTUI on the Bun runtime (P-1), with the
 * React tree rendered via OpenTUI's React reconciler (P-3). The core library
 * (skill discovery, install, conformance, registry, usage, sync) lives under
 * `src/core/` and is pure TypeScript with no UI dependencies.
 *
 * This bootstrap intentionally renders a minimal shell — the OpenTUI screen
 * surface for Library / Shop / Usage / Craft is being authored separately
 * against the new substrate; until it lands, the binary boots into an
 * informational placeholder so packaging and entrypoint resolution work.
 */

import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import { App } from './App'

async function main(): Promise<void> {
  const renderer = await createCliRenderer()
  createRoot(renderer).render(<App />)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
