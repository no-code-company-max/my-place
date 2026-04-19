import { test, expect } from '@playwright/test'

/**
 * Smoke del middleware multi-tenant contra dev server.
 * `*.localhost` lo resuelven los browsers modernos sin /etc/hosts.
 */

test('localhost:3000 → landing', async ({ page }) => {
  await page.goto('http://localhost:3000/')
  await expect(page.locator('h1')).toContainText('Place')
})

test('app.localhost:3000 → inbox', async ({ page }) => {
  await page.goto('http://app.localhost:3000/')
  await expect(page.locator('h1')).toContainText('Inbox')
})

test('{slug}.localhost:3000 → portada del place', async ({ page }) => {
  await page.goto('http://prueba.localhost:3000/')
  await expect(page.locator('h1')).toContainText('prueba')
})
