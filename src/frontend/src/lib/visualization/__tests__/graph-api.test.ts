import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/lib/api-client', () => ({
  get: vi.fn(),
}));

import { get } from '@/lib/api-client';
import {
  getGraphSnapshot,
  getGraphExport,
  getGraphNodes,
  getNodeDetail,
  buildQueryString,
} from '../graph-api';

const getMock = get as unknown as Mock;

describe('buildQueryString', () => {
  it('serializes scalars with = and joins with &', () => {
    expect(buildQueryString({ page: 2, limit: 200 })).toBe('page=2&limit=200');
  });

  it('skips undefined and null values', () => {
    expect(buildQueryString({ page: 1, limit: undefined, version: null })).toBe('page=1');
  });

  it('serializes arrays as repeated encoded keys (type%5B%5D=A&type%5B%5D=B)', () => {
    expect(buildQueryString({ type: ['Controller', 'Service'] })).toBe(
      'type%5B%5D=Controller&type%5B%5D=Service',
    );
  });

  it('returns an empty string when nothing is serializable', () => {
    expect(buildQueryString({})).toBe('');
    expect(buildQueryString({ version: undefined })).toBe('');
  });

  it('encodes values that contain reserved characters', () => {
    expect(buildQueryString({ type: ['C++'] })).toBe('type%5B%5D=C%2B%2B');
  });

  it('mixes scalar params with a repeated-key array', () => {
    expect(buildQueryString({ page: 2, type: ['Controller', 'Service'] })).toBe(
      'page=2&type%5B%5D=Controller&type%5B%5D=Service',
    );
  });
});

describe('getGraphSnapshot', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('GETs /api/v1/graph/:repoId', async () => {
    getMock.mockResolvedValue({
      success: true,
      data: { version: 3, nodeCount: 5, edgeCount: 9 },
    });

    await getGraphSnapshot('repo-1');

    expect(getMock).toHaveBeenCalledWith('/api/v1/graph/repo-1');
  });
});

describe('getGraphExport', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('GETs /api/v1/graph/:repoId/export without query when version is omitted', async () => {
    getMock.mockResolvedValue({ success: true, data: null });

    await getGraphExport('repo-1');

    expect(getMock).toHaveBeenCalledWith('/api/v1/graph/repo-1/export');
  });

  it('appends version to the query when provided', async () => {
    getMock.mockResolvedValue({ success: true, data: null });

    await getGraphExport('repo-1', 2);

    expect(getMock).toHaveBeenCalledWith('/api/v1/graph/repo-1/export?version=2');
  });
});

describe('getGraphNodes', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('GETs /api/v1/graph/:repoId/nodes with pagination query params', async () => {
    getMock.mockResolvedValue({ success: true, data: [] });

    await getGraphNodes('repo-1', { page: 2, limit: 200 });

    expect(getMock).toHaveBeenCalledWith('/api/v1/graph/repo-1/nodes?page=2&limit=200');
  });

  it('serializes a single type and an array of types as repeated type[] keys', async () => {
    getMock.mockResolvedValue({ success: true, data: [] });

    await getGraphNodes('repo-1', { type: 'Controller' });
    expect(getMock).toHaveBeenCalledWith('/api/v1/graph/repo-1/nodes?type%5B%5D=Controller');

    await getGraphNodes('repo-1', { type: ['Controller', 'Service'] });
    expect(getMock).toHaveBeenCalledWith(
      '/api/v1/graph/repo-1/nodes?type%5B%5D=Controller&type%5B%5D=Service',
    );
  });

  it('combines version, type and limit', async () => {
    getMock.mockResolvedValue({ success: true, data: [] });

    await getGraphNodes('repo-1', { version: 3, type: 'Module', limit: 200 });

    expect(getMock).toHaveBeenCalledWith(
      '/api/v1/graph/repo-1/nodes?version=3&limit=200&type%5B%5D=Module',
    );
  });

  it('calls with no query string when called without options', async () => {
    getMock.mockResolvedValue({ success: true, data: [] });

    await getGraphNodes('repo-1');

    expect(getMock).toHaveBeenCalledWith('/api/v1/graph/repo-1/nodes');
  });
});

describe('getNodeDetail', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('GETs /api/v1/graph/:repoId/nodes/:fqn with direction param', async () => {
    getMock.mockResolvedValue({ success: true, data: { node: {}, edges: [] } });

    await getNodeDetail('repo-1', 'my:fqn', 'out');

    expect(getMock).toHaveBeenCalledWith('/api/v1/graph/repo-1/nodes/my%3Afqn?direction=out');
  });

  it('defaults to no direction param when omitted (backend default: both)', async () => {
    getMock.mockResolvedValue({ success: true, data: { node: {}, edges: [] } });

    await getNodeDetail('repo-1', 'my:fqn');

    expect(getMock).toHaveBeenCalledWith('/api/v1/graph/repo-1/nodes/my%3Afqn');
  });

  it('supports the "in" direction', async () => {
    getMock.mockResolvedValue({ success: true, data: { node: {}, edges: [] } });

    await getNodeDetail('repo-1', 'my:fqn', 'in');

    expect(getMock).toHaveBeenCalledWith('/api/v1/graph/repo-1/nodes/my%3Afqn?direction=in');
  });

  it('percent-encodes FQN fragment markers so # never becomes a URL fragment', async () => {
    getMock.mockResolvedValue({ success: true, data: { node: {}, edges: [] } });

    await getNodeDetail('repo-1', 'my:pkg:Controller#handle');

    expect(getMock).toHaveBeenCalledWith(
      '/api/v1/graph/repo-1/nodes/my%3Apkg%3AController%23handle',
    );
  });
});
