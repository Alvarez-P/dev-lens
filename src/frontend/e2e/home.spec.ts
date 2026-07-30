import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test('should display the DevLens heading', async ({ page }) => {
    await page.goto('/');

    // Check that the page renders
    await expect(page.locator('h1')).toContainText('DevLens');

    // Check that the tagline is present
    await expect(page.locator('text=Software Intelligence Platform')).toBeVisible();

    // Check that "Coming soon" is displayed
    await expect(page.locator('text=Coming soon')).toBeVisible();
  });
});
