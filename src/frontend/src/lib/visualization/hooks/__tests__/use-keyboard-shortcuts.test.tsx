import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, fireEvent } from '@testing-library/react';
import { NodeType, EdgeType, LayoutType, ViewMode } from '@/lib/visualization/types';
import { useGraphStore } from '@/lib/visualization/store/graph-store';
import type { GraphStore } from '@/lib/visualization/store/graph-store';
import type { GraphRendererAdapter } from '@/lib/visualization/adapter';
import { useKeyboardShortcuts } from '../use-keyboard-shortcuts';

const initialState: GraphStore = useGraphStore.getState();

beforeEach(() => {
  useGraphStore.setState(initialState, true);
});

function renderShortcuts(adapter: Partial<GraphRendererAdapter> = {}, onFocusSearch?: () => void) {
  const adapterRef = { current: adapter as GraphRendererAdapter };
  renderHook(() => useKeyboardShortcuts({ adapterRef, onFocusSearch }));

  const press = (key: string, init: KeyboardEventInit = {}): void => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, ...init }));
  };

  return { press };
}

describe('useKeyboardShortcuts — viewport (REQ-VI-005)', () => {
  it('f fits the view', () => {
    const fitView = vi.fn();
    const { press } = renderShortcuts({ fitView });

    press('f');

    expect(fitView).toHaveBeenCalledOnce();
  });

  it('+ and = zoom in, - zooms out', () => {
    const zoomIn = vi.fn();
    const zoomOut = vi.fn();
    const { press } = renderShortcuts({ zoomIn, zoomOut });

    press('+');
    press('=');
    press('-');

    expect(zoomIn).toHaveBeenCalledTimes(2);
    expect(zoomOut).toHaveBeenCalledOnce();
  });

  it('r resets the view and clears selection and focus', () => {
    const fitView = vi.fn();
    act(() => {
      useGraphStore.getState().setSelectedNode('n1');
      useGraphStore.getState().setFocusNode('n1');
    });
    const { press } = renderShortcuts({ fitView });

    press('r');

    expect(fitView).toHaveBeenCalledOnce();
    expect(useGraphStore.getState().selectedNodeId).toBeNull();
    expect(useGraphStore.getState().focusNodeId).toBeNull();
  });

  it('Escape clears the selection and exits focus mode', () => {
    act(() => {
      useGraphStore.getState().setSelectedNode('n1');
      useGraphStore.getState().setFocusNode('n1');
    });
    const { press } = renderShortcuts();

    press('Escape');

    expect(useGraphStore.getState().selectedNodeId).toBeNull();
    expect(useGraphStore.getState().focusNodeId).toBeNull();
  });
});

describe('useKeyboardShortcuts — search focus', () => {
  it('Ctrl+F and Cmd+F focus the search input', () => {
    const onFocusSearch = vi.fn();
    const { press } = renderShortcuts({}, onFocusSearch);

    press('f', { ctrlKey: true });
    press('F', { metaKey: true });

    expect(onFocusSearch).toHaveBeenCalledTimes(2);
  });
});

describe('useKeyboardShortcuts — view switching', () => {
  it('1–7 switch to the numbered view', () => {
    const { press } = renderShortcuts();

    press('3');

    expect(useGraphStore.getState().viewMode).toBe(ViewMode.DEPENDENCY_TREE);
    expect(useGraphStore.getState().layout).toBe(LayoutType.RADIAL);
    expect(useGraphStore.getState().visibleEdgeTypes).toEqual([EdgeType.EXPOSES]);

    press('7');

    expect(useGraphStore.getState().viewMode).toBe(ViewMode.EVENT_FLOW);
    expect(useGraphStore.getState().visibleNodeTypes).toEqual([]);
  });

  it('ignores other digits', () => {
    const { press } = renderShortcuts();

    press('9');
    press('0');

    expect(useGraphStore.getState().viewMode).toBe(ViewMode.OVERVIEW);
  });
});

describe('useKeyboardShortcuts — disabled while typing', () => {
  it('ignores shortcuts when the event target is an input', () => {
    const fitView = vi.fn();
    const onFocusSearch = vi.fn();
    const { press } = renderShortcuts({ fitView }, onFocusSearch);

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    try {
      fireEvent.keyDown(input, { key: 'f' });
      fireEvent.keyDown(input, { key: '3' });
    } finally {
      document.body.removeChild(input);
    }

    expect(fitView).not.toHaveBeenCalled();
    expect(onFocusSearch).not.toHaveBeenCalled();
    expect(useGraphStore.getState().viewMode).toBe(ViewMode.OVERVIEW);
  });
});
