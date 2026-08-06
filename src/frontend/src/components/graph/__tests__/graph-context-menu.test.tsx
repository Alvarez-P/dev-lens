import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NodeType } from '@/lib/visualization/types';
import type { GraphNode } from '@/lib/visualization/types';

import { GraphContextMenu } from '../graph-context-menu';

function makeNode(): GraphNode {
  return {
    id: 'svc-1',
    type: NodeType.SERVICE,
    label: 'AuthService',
    fqn: 'my-project:pkg:AuthService',
    properties: {},
    repoId: 'repo-1',
    version: 1,
    deprecatedAt: null,
  };
}

const node = makeNode();

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('GraphContextMenu (REQ-VI-004)', () => {
  it('renders the four actions with the node identity', () => {
    render(<GraphContextMenu node={node} x={40} y={30} />);

    expect(screen.getByText('AuthService')).toBeInTheDocument();
    expect(screen.getByText('my-project:pkg:AuthService')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Copy FQN' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Show Dependencies' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Show Dependents' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Center on Node' })).toBeInTheDocument();
  });

  it('positions the menu at the cursor coordinates', () => {
    render(<GraphContextMenu node={node} x={120} y={90} />);

    const menu = screen.getByRole('menu');
    expect(menu).toHaveStyle({ left: '120px', top: '90px' });
  });

  it('clamps the position to stay within the viewport', () => {
    render(<GraphContextMenu node={node} x={99_999} y={99_999} />);

    const menu = screen.getByRole('menu');
    expect(Number.parseInt(menu.style.left, 10)).toBeLessThanOrEqual(1024);
    expect(Number.parseInt(menu.style.top, 10)).toBeLessThanOrEqual(768);
  });

  it('copies the FQN to the clipboard and closes', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const onClose = vi.fn();

    render(<GraphContextMenu node={node} x={10} y={10} onClose={onClose} />);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy FQN' }));

    expect(writeText).toHaveBeenCalledWith('my-project:pkg:AuthService');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('fires the neighborhood and center actions with the node id', () => {
    const onShowDependencies = vi.fn();
    const onShowDependents = vi.fn();
    const onCenterOnNode = vi.fn();

    render(
      <GraphContextMenu
        node={node}
        x={10}
        y={10}
        onShowDependencies={onShowDependencies}
        onShowDependents={onShowDependents}
        onCenterOnNode={onCenterOnNode}
      />,
    );

    fireEvent.click(screen.getByRole('menuitem', { name: 'Show Dependencies' }));
    expect(onShowDependencies).toHaveBeenCalledWith('svc-1');

    fireEvent.click(screen.getByRole('menuitem', { name: 'Show Dependents' }));
    expect(onShowDependents).toHaveBeenCalledWith('svc-1');

    fireEvent.click(screen.getByRole('menuitem', { name: 'Center on Node' }));
    expect(onCenterOnNode).toHaveBeenCalledWith('svc-1');
  });

  it('closes when clicking outside the menu', () => {
    const onClose = vi.fn();

    render(<GraphContextMenu node={node} x={10} y={10} onClose={onClose} />);
    fireEvent.mouseDown(document.body);

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not close when clicking inside the menu', () => {
    const onClose = vi.fn();

    render(<GraphContextMenu node={node} x={10} y={10} onClose={onClose} />);
    fireEvent.mouseDown(screen.getByRole('menu'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();

    render(<GraphContextMenu node={node} x={10} y={10} onClose={onClose} />);
    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
  });
});
