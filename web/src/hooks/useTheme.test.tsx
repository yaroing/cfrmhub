import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ThemeProvider, useTheme } from './useTheme'

function Toggler() {
  const { theme, toggle } = useTheme()
  return (
    <button type="button" onClick={toggle}>
      theme:{theme}
    </button>
  )
}

describe('useTheme', () => {
  it('bascule clair/sombre', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <Toggler />
      </ThemeProvider>,
    )
    const btn = screen.getByRole('button')
    const initial = btn.textContent
    await user.click(btn)
    expect(btn.textContent).not.toBe(initial)
  })
})
