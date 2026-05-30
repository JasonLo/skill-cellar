import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RegistryResult, SkillDescriptor } from '../api/bindings'
import { api } from '../api/client'
import { AppProvider } from '../state/AppContext'
import { ShopScreen } from './ShopScreen'

const RESULT: RegistryResult = {
  source: 'network',
  manifest: {
    schema_version: 1,
    generated_at: '2026-05-30T00:00:00Z',
    entries: [
      {
        name: 'web-fetch',
        description: 'Fetch a URL.',
        repo: 'agentskills/examples',
        subdir: 'skills/web-fetch',
        git_ref: null,
        featured: true,
      },
    ],
  },
}

const INSTALLED: SkillDescriptor = {
  name: 'web-fetch',
  dir_name: 'web-fetch',
  path: '/home/u/.claude/skills/web-fetch',
  description: 'Fetch a URL.',
  conformance: { verdict: 'valid', findings: [] },
}

function renderShop() {
  return render(
    <AppProvider>
      <ShopScreen />
    </AppProvider>,
  )
}

beforeEach(() => {
  // Pretend we're inside the Tauri webview so the Install button is live.
  ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
})

afterEach(() => {
  vi.restoreAllMocks()
  ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ =
    undefined
})

describe('Shop install', () => {
  // I-1 shop-install outcome (frontend surface): clicking Install on a shop
  // entry drives the GitHub-fetch install command for that entry into the
  // active target, and the result is surfaced to the user.
  it('installs a registry entry into the active target', async () => {
    vi.spyOn(api, 'getRegistry').mockResolvedValue(RESULT)
    const install = vi
      .spyOn(api, 'installRegistrySkill')
      .mockResolvedValue(INSTALLED)

    renderShop()

    const button = await screen.findByRole('button', { name: /install/i })
    expect(button).toBeEnabled()
    await userEvent.click(button)

    await waitFor(() =>
      expect(install).toHaveBeenCalledWith(RESULT.manifest.entries[0], {
        kind: 'global',
      }),
    )
    expect(
      await screen.findByText(/Installed “web-fetch” \(valid\)\./),
    ).toBeInTheDocument()
  })

  it('surfaces an install failure without crashing', async () => {
    vi.spyOn(api, 'getRegistry').mockResolvedValue(RESULT)
    vi.spyOn(api, 'installRegistrySkill').mockRejectedValue({
      kind: 'network',
      message: 'network unreachable: timed out',
    })

    renderShop()

    await userEvent.click(
      await screen.findByRole('button', { name: /install/i }),
    )

    expect(
      await screen.findByText(/Install failed: network unreachable/),
    ).toBeInTheDocument()
  })
})
