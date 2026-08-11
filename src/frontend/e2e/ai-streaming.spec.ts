import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TEST_ACCESS_TOKEN = 'e2e-access-token';
const TEST_REFRESH_TOKEN = 'e2e-refresh-token';

/** Single graph node served by the mocked KG endpoints (mirrors GraphNodeJson). */
const SERVICE_NODE = {
  id: 'n1',
  type: 'Service',
  label: 'AuthService',
  fqn: 'auth/AuthService',
  properties: { fileName: 'auth.service.ts' },
  repoId: 'repo-1',
  version: 1,
  deprecatedAt: null,
};

/** Serialize SSE data payloads into a text/event-stream body. */
function sseBody(payloads: string[]): string {
  return payloads.map((payload) => `data: ${payload}\n\n`).join('');
}

/** Mock auth + graph endpoints so the workspace renders a selectable node. */
async function stubGraphAndAuth(page: Page): Promise<void> {
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

  await page.route(`${API_BASE}/api/v1/graph/repo-1`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          snapshotId: 's1',
          repositoryId: 'repo-1',
          analysisId: 'a1',
          commitSha: 'abc123',
          version: 1,
          nodeCount: 1,
          edgeCount: 0,
          status: 'built',
          createdAt: '2026-01-01T00:00:00Z',
        },
      }),
    });
  });

  await page.route(`${API_BASE}/api/v1/graph/repo-1/nodes**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [SERVICE_NODE],
        meta: { total: 1, page: 1, limit: 200, totalPages: 1 },
      }),
    });
  });

  await page.route(`${API_BASE}/api/v1/graph/repo-1/export**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          nodes: [SERVICE_NODE],
          edges: [],
          meta: { nodeCount: 1, edgeCount: 0, version: 1 },
        },
      }),
    });
  });
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

/** Open the graph page and select the single mocked node. */
async function openGraphAndSelectNode(page: Page): Promise<void> {
  await page.goto('/repositories/repo-1/graph');

  const node = page.getByTestId('node');
  await expect(node).toBeVisible({ timeout: 10000 });
  await node.click();

  await expect(page.getByRole('button', { name: /analyze with ai/i })).toBeVisible({
    timeout: 10000,
  });
}

test.describe('AI streaming panel (task 6.4)', () => {
  test('renders AI tokens after analyzing a selected node', async ({ page }) => {
    await stubGraphAndAuth(page);
    await page.route(`${API_BASE}/api/v1/ai/stream**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: { 'Cache-Control': 'no-cache' },
        body: sseBody([
          '{"type":"token","content":"The AuthService"}',
          '{"type":"token","content":" handles authentication."}',
          '{"type":"done","content":"","tokens":2,"model":"mock-model"}',
        ]),
      });
    });

    await signIn(page);
    await openGraphAndSelectNode(page);

    await page.getByRole('button', { name: /analyze with ai/i }).click();

    const output = page.getByTestId('ai-analysis-output');
    await expect(output).toHaveText('The AuthService handles authentication.', { timeout: 10000 });

    // Completion: full text rendered, no streaming controls remain.
    await expect(page.getByRole('button', { name: /stop/i })).toHaveCount(0);
  });

  test('stops an in-flight AI stream when Stop is clicked', async ({ page }) => {
    await stubGraphAndAuth(page);
    await page.route(`${API_BASE}/api/v1/ai/stream**`, async (route) => {
      // Token events only — no done event, so the stream stays "in progress"
      // and the panel keeps showing the Stop button.
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: { 'Cache-Control': 'no-cache' },
        body: sseBody([
          '{"type":"token","content":"partial "}',
          '{"type":"token","content":"analysis"}',
        ]),
      });
    });

    await signIn(page);
    await openGraphAndSelectNode(page);

    await page.getByRole('button', { name: /analyze with ai/i }).click();

    await expect(page.getByTestId('ai-analysis-output')).toContainText('partial analysis', {
      timeout: 10000,
    });
    const stop = page.getByRole('button', { name: /stop/i });
    await expect(stop).toBeVisible();
    await stop.click();

    // Cancelled: back to the idle Analyze state and the output clears.
    await expect(page.getByRole('button', { name: /analyze with ai/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId('ai-analysis-output')).toHaveCount(0);
  });

  test('displays the error message when the AI stream fails', async ({ page }) => {
    await stubGraphAndAuth(page);
    await page.route(`${API_BASE}/api/v1/ai/stream**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sseBody([
          '{"type":"error","content":"AI provider unavailable","code":"PROVIDER_UNAVAILABLE"}',
        ]),
      });
    });

    await signIn(page);
    await openGraphAndSelectNode(page);

    await page.getByRole('button', { name: /analyze with ai/i }).click();

    await expect(page.getByRole('alert', { name: 'AI analysis error' })).toContainText(
      'AI provider unavailable',
      { timeout: 10000 },
    );
  });
});
