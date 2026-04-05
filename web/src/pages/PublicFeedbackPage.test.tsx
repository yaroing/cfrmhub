import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import { PublicFeedbackPage } from './PublicFeedbackPage'
import * as svc from '../services/feedbackService'

vi.mock('../services/feedbackService', () => ({
  submitPublicFeedback: vi.fn().mockResolvedValue({
    id: 'test-uuid',
    receipt_message: 'Merci.',
  }),
}))

describe('PublicFeedbackPage', () => {
  it('affiche erreur si description trop courte', async () => {
    const user = userEvent.setup()
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <PublicFeedbackPage />
        </MemoryRouter>
      </I18nextProvider>,
    )
    await user.type(screen.getByLabelText(/Description détaillée/i), 'court')
    await user.click(screen.getByRole('button', { name: /Envoyer le message/i }))
    expect(await screen.findByText(/Minimum 10 caractères/i)).toBeInTheDocument()
    expect(svc.submitPublicFeedback).not.toHaveBeenCalled()
  })

  it('soumet si description valide', async () => {
    const user = userEvent.setup()
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <PublicFeedbackPage />
        </MemoryRouter>
      </I18nextProvider>,
    )
    await user.type(
      screen.getByLabelText(/Description détaillée/i),
      'Situation détaillée sur place avec assez de texte.',
    )
    await user.click(screen.getByRole('button', { name: /Envoyer le message/i }))
    expect(await screen.findByText(/Message bien reçu/i)).toBeInTheDocument()
    expect(svc.submitPublicFeedback).toHaveBeenCalledOnce()
  })
})
