import { test, expect } from '@playwright/test';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TEST_ACCESS_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwidXNlcklkIjoiMDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAxIiwiaWF0IjoxNTE2MjM5MDIyfQ.test';
const TEST_REFRESH_TOKEN = 'test-refresh-token-123';

test.describe('OAuth Authentication', () => {
  test.describe('R5: Provider button visibility', () => {
    test('should show GitHub button when env var is set, hide when absent', async ({ page }) => {
      await page.goto('/login');

      const githubButton = page.locator('text=Sign in with GitHub');
      const hasButton = (await githubButton.count()) > 0;

      if (process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID) {
        expect(hasButton).toBe(true);
      } else {
        expect(hasButton).toBe(false);
      }
    });
  });
  test.describe('T6.1: OAuth callback resolution', () => {
    test('should store tokens from OAuth callback redirect and restore session', async ({
      page,
    }) => {
      // Intercept the auth/me endpoint to return a mock user
      await page.route(`${API_BASE}/api/v1/auth/me`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: '00000000-0000-0000-0000-000000000001',
              email: 'octocat@github.com',
              firstName: 'Octo',
              lastName: 'Cat',
              avatarUrl: 'https://avatars.githubusercontent.com/u/583231',
              isEmailVerified: true,
              createdAt: '2024-01-15T10:00:00Z',
            },
          }),
        });
      });

      // Navigate to root with OAuth callback params (simulating the redirect)
      // This is how the backend OAuth controller redirects after callback:
      // ${frontendUrl}/?oauth=success&accessToken=...&refreshToken=...
      await page.goto(
        `/?oauth=success&accessToken=${encodeURIComponent(TEST_ACCESS_TOKEN)}&refreshToken=${encodeURIComponent(TEST_REFRESH_TOKEN)}`,
      );

      // After OAuth callback, the auth context should store tokens and restore session
      // The page should show the "Go to Dashboard" button for authenticated users
      await expect(page.locator('text=Go to Dashboard')).toBeVisible({ timeout: 10000 });

      // Verify tokens were stored in localStorage
      const storedAccessToken = await page.evaluate(() =>
        localStorage.getItem('devlens_access_token'),
      );
      expect(storedAccessToken).toBe(TEST_ACCESS_TOKEN);

      const storedRefreshToken = await page.evaluate(() =>
        localStorage.getItem('devlens_refresh_token'),
      );
      expect(storedRefreshToken).toBe(TEST_REFRESH_TOKEN);

      // Verify the URL was cleaned of query params
      expect(page.url()).not.toContain('oauth=success');
      expect(page.url()).not.toContain('accessToken=');
    });

    test('should gracefully handle OAuth callback without tokens', async ({ page }) => {
      // Navigate with oauth=success but no tokens
      await page.goto('/?oauth=success');

      // Should show unauthenticated state (sign in buttons)
      await expect(page.locator('text=Sign in')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('T6.2: Identity linking settings UI', () => {
    test.beforeEach(async ({ page }) => {
      // Mock auth/me
      await page.route(`${API_BASE}/api/v1/auth/me`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: '00000000-0000-0000-0000-000000000001',
              email: 'user@example.com',
              firstName: 'Test',
              lastName: 'User',
              avatarUrl: null,
              isEmailVerified: true,
              createdAt: '2024-01-15T10:00:00Z',
            },
          }),
        });
      });

      // Mock linked identities endpoint
      await page.route(`${API_BASE}/api/v1/users/identities`, async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: [
                {
                  id: 'identity-1',
                  provider: 'github',
                  displayName: 'octocat',
                  avatarUrl: 'https://avatars.githubusercontent.com/u/583231',
                  linkedAt: '2024-06-01T12:00:00Z',
                },
              ],
            }),
          });
        } else {
          await route.continue();
        }
      });

      // Set auth token in localStorage to simulate logged-in state
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.setItem('devlens_access_token', TEST_ACCESS_TOKEN);
        localStorage.setItem('devlens_refresh_token', TEST_REFRESH_TOKEN);
      });
    });

    test('should display linked identities on security settings page', async ({ page }) => {
      await page.goto('/settings/security');

      // Should show the linked accounts section
      await expect(page.locator('text=Linked accounts')).toBeVisible({ timeout: 10000 });

      // Should show the GitHub identity with display name
      await expect(page.locator('text=github')).toBeVisible();
      await expect(page.locator('text=octocat')).toBeVisible();

      // Should show the Unlink button
      await expect(page.locator('text=Unlink')).toBeVisible();
    });

    test('should unlink an identity successfully', async ({ page }) => {
      // Mock the unlink endpoint
      const identityId = 'identity-1';
      await page.route(`${API_BASE}/api/v1/users/identities/${identityId}`, async (route) => {
        if (route.request().method() === 'DELETE') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { message: 'Identity unlinked successfully' },
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto('/settings/security');

      // Click Unlink and verify the identity is removed from the list
      await page.locator('text=Unlink').click();

      // The identity should be removed from the UI
      await expect(page.locator('text=octocat')).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('T6.3: Unlink guard — sole identity', () => {
    test.beforeEach(async ({ page }) => {
      // Mock auth/me for a user with no password (OAuth-only user)
      await page.route(`${API_BASE}/api/v1/auth/me`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: '00000000-0000-0000-0000-000000000002',
              email: 'oauth-only@github.com',
              firstName: 'OAuth',
              lastName: 'Only',
              avatarUrl: null,
              isEmailVerified: true,
              createdAt: '2024-06-01T12:00:00Z',
            },
          }),
        });
      });

      // Mock identities — single identity, no password set on user
      await page.route(`${API_BASE}/api/v1/users/identities`, async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: [
                {
                  id: 'sole-identity',
                  provider: 'github',
                  displayName: 'oauth-only-user',
                  avatarUrl: null,
                  linkedAt: '2024-06-01T12:00:00Z',
                },
              ],
            }),
          });
        } else {
          await route.continue();
        }
      });

      // Mock the unlink endpoint to return 400 CannotUnlinkSoleIdentity
      await page.route(`${API_BASE}/api/v1/users/identities/sole-identity`, async (route) => {
        if (route.request().method() === 'DELETE') {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              statusCode: 400,
              message:
                'Cannot unlink the sole authentication method. Set a password or link another provider first.',
              error: 'CANNOT_UNLINK_SOLE_IDENTITY',
              correlationId: 'test-correlation-id',
              timestamp: new Date().toISOString(),
              path: '/api/v1/users/identities/sole-identity',
            }),
          });
        } else {
          await route.continue();
        }
      });

      // Set auth token in localStorage
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.setItem('devlens_access_token', TEST_ACCESS_TOKEN);
        localStorage.setItem('devlens_refresh_token', TEST_REFRESH_TOKEN);
      });
    });

    test('should prevent unlinking the sole authentication method', async ({ page }) => {
      await page.goto('/settings/security');

      // Should show the linked account
      await expect(page.locator('text=github')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=oauth-only-user')).toBeVisible();

      // Click Unlink
      await page.locator('text=Unlink').click();

      // Should show the error toast
      await expect(page.locator('text=Cannot unlink the sole authentication method')).toBeVisible({
        timeout: 5000,
      });

      // The identity should still be visible (not removed from UI)
      await expect(page.locator('text=oauth-only-user')).toBeVisible();
    });
  });
});
