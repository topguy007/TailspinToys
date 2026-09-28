/**
 * Covers homepage content and the shared persistent display preference control.
 */

import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the correct title', async ({ page }) => {
    // Check that the page title is correct
    await expect(page).toHaveTitle('Tailspin Toys - Crowdfunding your new favorite game!');
  });

  test('should display the main heading', async ({ page }) => {
    // Check that the main page heading is present
    await expect(page.getByRole('heading', { name: 'Welcome to Tailspin Toys', exact: true })).toBeVisible();
  });

  test('should display the site branding in header', async ({ page }) => {
    // Check that the site branding is present in the header (no longer an h1)
    await expect(page.getByText('Tailspin Toys').first()).toBeVisible();
  });

  test('should display the welcome message', async ({ page }) => {
    // Check that the welcome message is present using more specific locator
    await expect(page.getByText('Find your next game! And maybe even back one! Explore our collection!')).toBeVisible();
  });

  test('should persist high-contrast mode across reloads and page navigation', async ({ page }) => {
    const toggle = page.getByTestId('high-contrast-toggle');

    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toHaveText('High contrast: On');
    await expect(page.locator('html')).toHaveAttribute('data-high-contrast', 'true');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
    await expect(page.getByTestId('game-card').first()).toHaveCSS('color', 'rgb(255, 255, 0)');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('tailspin-high-contrast'))).toBe('true');

    await page.reload();
    await expect(page.getByTestId('high-contrast-toggle')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-high-contrast', 'true');

    await page.goto('/about');
    await expect(page.getByTestId('high-contrast-toggle')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-high-contrast', 'true');

    await page.getByTestId('high-contrast-toggle').click();
    await expect(page.getByTestId('high-contrast-toggle')).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('tailspin-high-contrast'))).toBe('false');
  });
});
