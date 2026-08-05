/**
 * Re-export of the renderer abstraction contract (tasks C3-02).
 *
 * The interface itself lives at `@/lib/visualization/adapter` (created in
 * C2-01). This module gives the `components/graph` layer a stable import
 * path for the contract and for future adapter implementations (C6), so no
 * duplicate definition exists.
 */
export type { GraphRendererAdapter } from '@/lib/visualization/adapter';
