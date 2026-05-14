import { expect, test } from '@playwright/test'

async function mockPublicSetupApis(page) {
  await page.route('**/api/v1/auth/register-status', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ enabled: true, has_users: false }),
  }))
  await page.route('**/api/v1/student-auth/accept-invite', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      message: 'Invite accepted',
      activation_id: 'activation-test',
      expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      resend_available_at: new Date(Date.now() + 60_000).toISOString(),
    }),
  }))
}

test.describe('UX recovery public flows', () => {
  test.beforeEach(async ({ page }) => {
    await mockPublicSetupApis(page)
  })

  test('login is role-neutral and exposes activation path', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText(/school portal/i).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /parent\/student activation/i })).toBeVisible()
    await expect(page.getByText(/administrator portal/i)).toHaveCount(0)
  })

  test('invite link skips admission-number puzzle and goes straight to OTP', async ({ page }) => {
    await page.goto('/activate-account?invite=test-invite-token')
    await expect(page.getByRole('heading', { name: /verify code/i })).toBeVisible()
    await expect(page.getByLabel(/activation code/i)).toBeVisible()
  })

  test('first-run setup collects school, year, classes, and admin together', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByRole('heading', { name: /set up your school/i })).toBeVisible()
    await expect(page.getByText('School Name')).toBeVisible()
    await expect(page.getByText('Academic Year', { exact: true })).toBeVisible()
    await expect(page.getByText('Standards')).toBeVisible()
    await expect(page.getByText('Full Name')).toBeVisible()
  })

  test('mobile activation screen has no horizontal overflow', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile-only layout check')
    await page.goto('/activate-account')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
  })
})
