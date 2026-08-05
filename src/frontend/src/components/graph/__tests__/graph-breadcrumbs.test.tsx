import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useGraphStore } from '@/lib/visualization/store/graph-store';
import type { GraphStore } from '@/lib/visualization/store/graph-store';
import { GraphBreadcrumbs } from '../graph-breadcrumbs';

const initialState: GraphStore = useGraphStore.getState();

beforeEach(() => {
  useGraphStore.setState(initialState, true);
});

describe('GraphBreadcrumbs — empty state', () => {
  it('renders a "Graph" root label when the trail is empty', () => {
    render(<GraphBreadcrumbs />);

    expect(screen.getByText('Graph')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('GraphBreadcrumbs — trail rendering', () => {
  it('renders every segment in order with a separator between them', () => {
    useGraphStore.setState({ breadcrumbs: ['my-repo', 'my-pkg', 'AuthModule'] });
    render(<GraphBreadcrumbs />);

    expect(screen.getByText('my-repo')).toBeInTheDocument();
    expect(screen.getByText('my-pkg')).toBeInTheDocument();
    expect(screen.getByText('AuthModule')).toBeInTheDocument();
    // Three segments → exactly two separators between them.
    expect(screen.getAllByText('>')).toHaveLength(2);
  });

  it('marks the current (last) segment as non-clickable and current', () => {
    useGraphStore.setState({ breadcrumbs: ['my-repo', 'my-pkg', 'AuthModule'] });
    render(<GraphBreadcrumbs />);

    // Only the two ancestors are buttons; the current segment is plain text.
    expect(screen.queryByRole('button', { name: /AuthModule/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /my-repo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /my-pkg/i })).toBeInTheDocument();

    expect(screen.getByText('AuthModule')).toHaveAttribute('aria-current', 'page');
  });
});

describe('GraphBreadcrumbs — back navigation', () => {
  it('truncates the trail to the clicked segment and notifies the caller', () => {
    useGraphStore.setState({ breadcrumbs: ['my-repo', 'my-pkg', 'AuthModule'] });
    const onNavigateTo = vi.fn();

    render(<GraphBreadcrumbs onNavigateTo={onNavigateTo} />);

    fireEvent.click(screen.getByRole('button', { name: /my-pkg/i }));

    expect(useGraphStore.getState().breadcrumbs).toEqual(['my-repo', 'my-pkg']);
    expect(onNavigateTo).toHaveBeenCalledWith(1);
  });

  it('collapses to the root when the first segment is clicked', () => {
    useGraphStore.setState({ breadcrumbs: ['my-repo', 'my-pkg', 'AuthModule'] });
    const onNavigateTo = vi.fn();

    render(<GraphBreadcrumbs onNavigateTo={onNavigateTo} />);

    fireEvent.click(screen.getByRole('button', { name: /my-repo/i }));

    expect(useGraphStore.getState().breadcrumbs).toEqual(['my-repo']);
    expect(onNavigateTo).toHaveBeenCalledWith(0);
  });

  it('does nothing when the current (last) segment is interacted with', () => {
    useGraphStore.setState({ breadcrumbs: ['my-repo', 'my-pkg'] });
    const onNavigateTo = vi.fn();

    render(<GraphBreadcrumbs onNavigateTo={onNavigateTo} />);

    fireEvent.click(screen.getByText('my-pkg'));

    expect(useGraphStore.getState().breadcrumbs).toEqual(['my-repo', 'my-pkg']);
    expect(onNavigateTo).not.toHaveBeenCalled();
  });
});
