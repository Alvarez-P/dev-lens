import { get, post, isSuccessResponse } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth/token-storage';

/** Canonical doc types (mirror backend DocType enum). */
export type DocType =
  'readme' | 'architecture-guide' | 'api-reference' | 'module-docs' | 'onboarding-guide';

/** Artifact formats (mirror backend DocFormat enum). */
export type DocFormat = 'markdown' | 'html' | 'openapi' | 'mermaid' | 'plantuml' | 'json';

/** List endpoint artifact shape (api R2). */
export interface DocArtifactSummary {
  id: string;
  docType: DocType;
  format: DocFormat;
  sizeBytes: number;
  generatedAt: string;
  templateVersion: string;
  commitSha: string;
}

/** Job status endpoint shape (api R3 progress). */
export interface DocJobStatus {
  jobId: string;
  state: string;
  progress: number;
  failedReason: string | null;
}

/** Human-readable doc type titles (views R2). */
export const DOC_TYPE_LABELS: Record<DocType, string> = {
  readme: 'README',
  'architecture-guide': 'Architecture Guide',
  'api-reference': 'API Reference',
  'module-docs': 'Module Documentation',
  'onboarding-guide': 'Onboarding Guide',
};

/** All doc types in display order (views R2 — one card each). */
export const ALL_DOC_TYPES: DocType[] = [
  'readme',
  'architecture-guide',
  'api-reference',
  'module-docs',
  'onboarding-guide',
];

/** Format label for badges (views R2). */
export const DOC_FORMAT_LABELS: Record<DocFormat, string> = {
  markdown: 'Markdown',
  html: 'HTML',
  openapi: 'OpenAPI',
  mermaid: 'Mermaid',
  plantuml: 'PlantUML',
  json: 'JSON',
};

/** File extension per format — mirrors backend doc-file-meta.ts (api R4). */
export const DOC_FORMAT_EXT: Record<DocFormat, string> = {
  markdown: 'md',
  html: 'html',
  openapi: 'openapi.json',
  mermaid: 'mmd',
  plantuml: 'puml',
  json: 'json',
};

/** Attachment filename: `{docType}.{ext}` (api R4, views R4). */
export function downloadFilenameFor(docType: DocType, format: DocFormat): string {
  return `${docType}.${DOC_FORMAT_EXT[format]}`;
}

/** Short locale date, e.g. "Aug 10, 2026" (views R2). */
export function formatGeneratedDate(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Group artifacts by docType, newest first within each group (views R2). */
export function groupArtifactsByDocType(
  artifacts: DocArtifactSummary[],
): Map<DocType, DocArtifactSummary[]> {
  const grouped = new Map<DocType, DocArtifactSummary[]>();
  for (const artifact of artifacts) {
    const list = grouped.get(artifact.docType) ?? [];
    list.push(artifact);
    grouped.set(artifact.docType, list);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }
  return grouped;
}

/** GET /repositories/:id/docs — all artifacts for a repository (api R2). */
export async function listDocs(repoId: string): Promise<DocArtifactSummary[]> {
  const response = await get<DocArtifactSummary[]>(`/api/v1/repositories/${repoId}/docs`);
  if (isSuccessResponse(response) && Array.isArray(response.data)) {
    return response.data;
  }
  return [];
}

/**
 * POST /repositories/:id/docs/generate — enqueue a generation job (api R1).
 * The backend responds 202 with the bare `{ jobId }` shape (no success
 * envelope), so both the wrapped and bare shapes are accepted.
 */
export async function generateDocs(repoId: string, docTypes?: DocType[]): Promise<string> {
  const body = docTypes !== undefined ? { docTypes } : undefined;
  const response = await post<{ jobId: string }>(
    `/api/v1/repositories/${repoId}/docs/generate`,
    body,
  );
  const candidate = response as unknown as { jobId?: string };
  if (isSuccessResponse(response) && response.data) {
    return response.data.jobId;
  }
  if (candidate.jobId) {
    return candidate.jobId;
  }
  throw new Error('Failed to start documentation generation');
}

/** GET /repositories/:id/docs/jobs/:jobId — poll generation progress (api R3). */
export async function getDocJob(repoId: string, jobId: string): Promise<DocJobStatus> {
  const response = await get<DocJobStatus>(`/api/v1/repositories/${repoId}/docs/jobs/${jobId}`);
  if (isSuccessResponse(response)) {
    return response.data;
  }
  throw new Error('Failed to load generation job');
}

/** Stage label for a progress percentage (documentation-generation R5). */
export function parseProgressStage(progress: number): string {
  if (progress >= 100) return 'Storing artifacts';
  if (progress >= 80) return 'Rendering formats';
  if (progress >= 60) return 'Enriching with AI';
  if (progress >= 40) return 'Extracting content';
  if (progress >= 20) return 'Selecting templates';
  return 'Queued';
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Fetch the raw artifact bytes from the download endpoint (views R3) and
 * return them as text. The download endpoint requires the Bearer token, so a
 * plain fetch with the stored token is used instead of the JSON api-client.
 */
export async function fetchDocText(repoId: string, docId: string): Promise<string> {
  const token = getAccessToken();
  const response = await fetch(`${BASE_URL}/api/v1/repositories/${repoId}/docs/${docId}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error(`Failed to download artifact (HTTP ${response.status})`);
  }
  return response.text();
}

/**
 * Download an artifact to the browser (views R4). The download endpoint
 * streams bytes and requires the Bearer token, so the file is fetched with
 * the token and saved via a temporary object URL with the backend's
 * `{docType}.{ext}` filename.
 */
export async function downloadDocArtifact(
  repoId: string,
  docId: string,
  filename: string,
): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(`${BASE_URL}/api/v1/repositories/${repoId}/docs/${docId}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error(`Download failed (HTTP ${response.status})`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
