import { test, expect } from '@playwright/test';

const routes = [
  '/login',
  '/agronomist/visit-command',
  '/analytics',
  '/executive',
  '/escalations',
  '/ai-ops/weakness',
  '/ai-ops/retraining',
  '/intelligence?tab=protocols',
  '/agronomist/outcome-intelligence',
  '/copilot/similar-cases',
  '/copilot/knowledge',
  '/product-gaps',
];

for (const path of routes) {
  test(`smoke: ${path} loads`, async ({ page }) => {
    const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
  });
}
