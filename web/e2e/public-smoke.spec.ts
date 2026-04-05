import { expect, test } from '@playwright/test'

test.describe('Espace public (sans Supabase pour la validation client)', () => {
  test('accueil charge et titre CFRM Hub', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/CFRM Hub/i)
  })

  test('navigation vers le formulaire public', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /Soumettre un feedback|Submit feedback/i }).first().click()
    await expect(page).toHaveURL(/\/feedback$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('formulaire public : erreur si description trop courte', async ({ page }) => {
    await page.goto('/feedback')
    const desc = page.getByRole('textbox', { name: /Description détaillée|Description \*/i })
    await desc.fill('court')
    await page.getByRole('button', { name: /Envoyer le message|Send message/i }).click()
    await expect(page.locator('[role="alert"]').first()).toBeVisible()
    await expect(page.locator('[role="alert"]').first()).toContainText(/10|At least|caractères|characters/i)
  })
})
