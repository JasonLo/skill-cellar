import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Conformance } from '../api/bindings'
import { api } from '../api/client'
import { AppProvider } from '../state/AppContext'
import { CraftScreen } from './CraftScreen'

function renderCraft() {
  return render(
    <AppProvider>
      <CraftScreen />
    </AppProvider>,
  )
}

const INVALID: Conformance = {
  verdict: 'invalid',
  findings: [
    {
      field: 'name',
      severity: 'error',
      code: 'name.format',
      message: '`name` must be lowercase letters, digits, and single hyphens',
    },
  ],
}

const VALID: Conformance = { verdict: 'valid', findings: [] }

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Craft publish gate', () => {
  // The I-3 EARS outcome: invalid frontmatter blocks publish AND shows the rule.
  it('blocks publish on invalid frontmatter', async () => {
    const check = vi.spyOn(api, 'checkConformance').mockResolvedValue(INVALID)

    renderCraft()
    await userEvent.type(screen.getByLabelText(/name/i), 'Bad Name')

    // (a) the failing rule is rendered inline …
    expect(
      await screen.findByText(INVALID.findings[0].message),
    ).toBeInTheDocument()
    // … and (b) Publish is disabled.
    expect(screen.getByRole('button', { name: /publish/i })).toBeDisabled()
    expect(check).toHaveBeenCalled()
  })

  it('enables publish when frontmatter is valid', async () => {
    vi.spyOn(api, 'checkConformance').mockResolvedValue(VALID)

    renderCraft()
    await userEvent.type(screen.getByLabelText(/name/i), 'web-fetch')

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /publish/i })).toBeEnabled(),
    )
  })
})
