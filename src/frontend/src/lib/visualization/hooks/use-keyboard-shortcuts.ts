import { useEffect, type RefObject } from 'react';
import { useGraphStore } from '@/lib/visualization/store/graph-store';
import { VIEWS, applyViewMode } from '@/lib/visualization/views';
import type { GraphRendererAdapter } from '@/lib/visualization/adapter';

export interface KeyboardShortcutsOptions {
  /** Adapter ref driving fit/zoom shortcuts (REQ-VI-005). */
  adapterRef?: RefObject<GraphRendererAdapter | null>;
  /** Fired on Ctrl+F / Cmd+F so the workspace can focus the search input. */
  onFocusSearch?: () => void;
}

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
};

/**
 * Global keyboard shortcuts for the graph page (REQ-VI-005):
 *
 * | Key                | Action                                   |
 * |--------------------|------------------------------------------|
 * | `f`                | Fit view                                 |
 * | `+` / `=`          | Zoom in (10% step)                       |
 * | `-`                | Zoom out (10% step)                      |
 * | `r`                | Reset view (fit + clear selection/focus) |
 * | `Escape`           | Clear selection / exit focus mode        |
 * | `Ctrl+F` / `Cmd+F` | Focus the search input                   |
 * | `1`–`7`            | Switch to view 1–7                       |
 *
 * Shortcuts are ignored while the user is typing in an input/textarea/select
 * or a contentEditable element. Ctrl/Cmd/Alt-modified keys (other than
 * Ctrl/Cmd+F) are ignored so browser/OS shortcuts keep working.
 */
export function useKeyboardShortcuts({
  adapterRef,
  onFocusSearch,
}: KeyboardShortcutsOptions = {}): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target)) return;

      const modified = event.ctrlKey || event.metaKey;

      if (modified && (event.key === 'f' || event.key === 'F')) {
        event.preventDefault();
        onFocusSearch?.();
        return;
      }
      if (modified || event.altKey) return;

      const adapter = adapterRef?.current;
      const { clearSelection, clearFocus } = useGraphStore.getState();

      switch (event.key) {
        case 'f':
        case 'F':
          adapter?.fitView();
          break;
        case '+':
        case '=':
          adapter?.zoomIn();
          break;
        case '-':
        case '_':
          adapter?.zoomOut();
          break;
        case 'r':
        case 'R':
          adapter?.fitView();
          clearSelection();
          clearFocus();
          break;
        case 'Escape':
          clearSelection();
          clearFocus();
          break;
        default:
          if (/^[1-7]$/.test(event.key)) {
            applyViewMode(VIEWS[Number(event.key) - 1].mode);
          }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [adapterRef, onFocusSearch]);
}
