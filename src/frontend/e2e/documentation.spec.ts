import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TEST_ACCESS_TOKEN = 'e2e-access-token';
const TEST_REFRESH_TOKEN = 'e2e-refresh-token';

/** A generated README markdown artifact (views R2 shape). */
const README_ARTIFACT = {
  id: 'doc-readme',
  docType: 'readme',
  format: 'markdown',
  sizeBytes: 15360,
  generatedAt: '2026-08-10T12:00:00.000Z',
  templateVersion: '1',
  commitSha: 'abc123',
};

/** Markdown exercising the viewer: headings, GFM table, code block, AI marker (R3, R6). */
const README_MARKDOWN = [
  '# ACME Service',
  '',
  '## Module Purpose',
  '<!-- devlens:ai -->',
  '',
  'The ACME service handles user authentication.',
  '',
  '| method | path |',
  '| --- | --- |',
  '| GET | /users |',
  '',
  '```ts',
  'const x: number = 1;',
  '```',
].join('\n');

async function stubAuth(page: Page): Promise<void> {
  await page.route(`${API_BASE}/api/v1/auth/me`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'e2e@example.com',
          firstName: 'E2E',
          lastName: 'Tester',
          avatarUrl: null,
          isEmailVerified: true,
          createdAt: '2026-01-01T00:00:00Z',
        },
      }),
    });
  });

  await page.route(`${API_BASE}/api/v1/repositories/repo-1`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: 'repo-1',
          name: 'acme-service',
          url: 'https://github.com/acme/acme-service',
          provider: 'github',
          status: 'SYNCED',
          defaultBranch: 'main',
          lastSyncAt: '2026-08-10T00:00:00Z',
          lastSyncCommit: 'abc123',
          lastSyncError: null,
          sizeBytes: 4096,
          fileCount: 42,
          createdAt: '2026-01-01T00:00:00Z',
        },
      }),
    });
  });
}

/**
 * Stub the docs endpoints. `state.artifacts` can be swapped after generation
 * so the list refresh shows the new artifact (views R5).
 */
async function stubDocs(page: Page, state: { artifacts: unknown[] }): Promise<void> {
  const jobState = { polled: false };
  await page.route(`${API_BASE}/api/v1/repositories/repo-1/docs`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: state.artifacts }),
    });
  });

  await page.route(`${API_BASE}/api/v1/repositories/repo-1/docs/generate`, async (route) => {
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ jobId: 'job-1' }),
    });
  });

  // First poll reports active (progress renders), the next completes it (R5).
  await page.route(`${API_BASE}/api/v1/repositories/repo-1/docs/jobs/job-1`, async (route) => {
    if (!jobState.polled) {
      jobState.polled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { jobId: 'job-1', state: 'active', progress: 40, failedReason: null },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { jobId: 'job-1', state: 'completed', progress: 100, failedReason: null },
      }),
    });
  });

  // Metadata (viewer) and raw content streamed from the download endpoint.
  await page.route(`${API_BASE}/api/v1/repositories/repo-1/docs/doc-readme`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: 'doc-readme',
          repositoryId: 'repo-1',
          commitSha: 'abc123',
          docType: 'readme',
          format: 'markdown',
          sizeBytes: README_MARKDOWN.length,
          generatedAt: '2026-08-10T12:00:00.000Z',
          templateVersion: '1',
          aiModelVersion: null,
          status: 'completed',
          downloadUrl: `${API_BASE}/api/v1/repositories/repo-1/docs/doc-readme/download`,
        },
      }),
    });
  });

  await page.route(
    `${API_BASE}/api/v1/repositories/repo-1/docs/doc-readme/download`,
    async (route) => {
      await route.fulfill({ status: 200, contentType: 'text/markdown', body: README_MARKDOWN });
    },
  );
}

/** Seed the session tokens (same origin, so they persist across navigation). */
async function signIn(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(
    ([accessToken, refreshToken]) => {
      localStorage.setItem('devlens_access_token', accessToken);
      localStorage.setItem('devlens_refresh_token', refreshToken);
    },
    [TEST_ACCESS_TOKEN, TEST_REFRESH_TOKEN],
  );
}

test.describe('Documentation views (7.2–7.5)', () => {
  test('docs list → generate → refreshed list (empty state, progress, artifact)', async ({
    page,
  }) => {
    const state = { artifacts: [] as unknown[] };
    await stubAuth(page);
    await stubDocs(page, state);
    await signIn(page);

    await page.goto('/repositories/repo-1/docs');

    // Empty state (R7) with the generate CTA.
    await expect(page.getByText(/No documentation generated yet/i)).toBeVisible({ timeout: 10000 });
    const generate = page.getByRole('button', { name: /generate documentation/i });
    await expect(generate).toBeVisible();

    // Generate (R5): button is replaced by the progress indicator, then the list refreshes.
    await generate.click();
    await expect(page.getByTestId('generation-progress')).toBeVisible({ timeout: 10000 });
    state.artifacts = [README_ARTIFACT];
    await expect(page.getByText('README')).toBeVisible({ timeout: 10000 });
  });

  test('docs list → viewer renders markdown, GFM table, highlighting and the AI badge', async ({
    page,
  }) => {
    const state = { artifacts: [README_ARTIFACT] };
    await stubAuth(page);
    await stubDocs(page, state);
    await signIn(page);

    await page.goto('/repositories/repo-1/docs');
    await expect(page.getByText('README')).toBeVisible({ timeout: 10000 });

    // Navigate to the viewer (R3) and check the rendered markdown (R3, R6).
    await page.getByRole('link', { name: /view/i }).click();
    await page.waitForURL('**/repositories/repo-1/docs/doc-readme');

    await expect(page.getByTestId('markdown-viewer')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Module Purpose/i })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.locator('code.hljs').first()).toBeVisible();
    await expect(page.getByTestId('ai-generated-badge')).toBeVisible();
  });
});
