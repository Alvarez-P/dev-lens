'use client';

import { useEffect, useRef } from 'react';
import { Copy, ArrowRight, ArrowLeft, Crosshair } from 'lucide-react';
import { Badge } from '@/components/atoms/badge';
import type { GraphNode } from '@/lib/visualization/types';

const MENU_WIDTH = 208;
const MENU_HEIGHT = 176;

export interface GraphContextMenuProps {
  /** The right-clicked node (label/fqn shown, id used by the actions). */
  node: GraphNode;
  /** Cursor position at right-click (viewport coordinates). */
  x: number;
  y: number;
  onShowDependencies?: (nodeId: string) => void;
  onShowDependents?: (nodeId: string) => void;
  onCenterOnNode?: (nodeId: string) => void;
  onClose?: () => void;
}

/**
 * Right-click context menu on graph nodes (REQ-VI-004): Copy FQN, Show
 * Dependencies, Show Dependents, Center on Node. Rendered at the cursor
 * position (clamped inside the viewport), dismisses on outside click or
 * Escape. `.glass-elevated` surface: `bg-surface-800 border-white/[0.06]`.
 */
export function GraphContextMenu({
  node,
  x,
  y,
  onShowDependencies,
  onShowDependents,
  onCenterOnNode,
  onClose,
}: GraphContextMenuProps): React.ReactNode {
  const rootRef = useRef<HTMLDivElement>(null);

  const left = Math.max(8, Math.min(x, window.innerWidth - MENU_WIDTH - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - MENU_HEIGHT - 8));

  useEffect(() => {
    const onMouseDown = (event: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        onClose?.();
      }
    };
    const onEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [onClose]);

  const run = (action: () => void) => (): void => {
    action();
    onClose?.();
  };

  const menuItemClass =
    'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-surface-200 transition-colors hover:bg-white/[0.06] hover:text-surface-100';

  return (
    <div
      ref={rootRef}
      role="menu"
      aria-label="Node actions"
      style={{ left, top }}
      onContextMenu={(event) => event.preventDefault()}
      className="fixed z-50 w-52 rounded-lg border border-white/[0.06] bg-surface-800 p-1 shadow-lg"
    >
      <div className="mb-1 border-b border-white/[0.06] px-2.5 py-2">
        <div className="flex items-center gap-2">
          <span className="min-w-0 truncate text-sm font-medium text-surface-100">
            {node.label}
          </span>
          <Badge size="sm">{node.type}</Badge>
        </div>
        <p className="mt-0.5 truncate font-mono text-xs text-surface-400">{node.fqn}</p>
      </div>

      <button
        type="button"
        role="menuitem"
        onClick={run(() => {
          void navigator.clipboard?.writeText(node.fqn);
        })}
        className={menuItemClass}
      >
        <Copy className="h-4 w-4 text-surface-400" aria-hidden="true" />
        Copy FQN
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={run(() => onShowDependencies?.(node.id))}
        className={menuItemClass}
      >
        <ArrowRight className="h-4 w-4 text-surface-400" aria-hidden="true" />
        Show Dependencies
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={run(() => onShowDependents?.(node.id))}
        className={menuItemClass}
      >
        <ArrowLeft className="h-4 w-4 text-surface-400" aria-hidden="true" />
        Show Dependents
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={run(() => onCenterOnNode?.(node.id))}
        className={menuItemClass}
      >
        <Crosshair className="h-4 w-4 text-surface-400" aria-hidden="true" />
        Center on Node
      </button>
    </div>
  );
}
