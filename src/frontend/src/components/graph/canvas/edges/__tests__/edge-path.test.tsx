import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { EdgeProps } from '@xyflow/react';
import { Position } from '@xyflow/react';

vi.mock('@xyflow/react', async () => {
  const { xyflowMock } = await import('../../__tests__/helpers/xyflow-mock');
  return xyflowMock;
});

import { EdgeType } from '@/lib/visualization/types';
import type { GraphEdge } from '@/lib/visualization/types';
import { EdgePath } from '../edge-path';
import { EDGE_STYLE, type EdgeStyle } from '../edge-style';

/** Mirror of the production travel duration — the tests define this contract. */
const TOKEN_TRAVEL_MS = 800;

function makeEdge(id = 'e1'): GraphEdge {
  return {
    id,
    type: EdgeType.INVOKES,
    sourceNodeId: 'src',
    targetNodeId: 'tgt',
    properties: {},
    version: 1,
  };
}

type EdgePathTestProps = EdgeProps & { styleConfig: EdgeStyle };

function makeProps(edge: GraphEdge, overrides: Partial<EdgePathTestProps> = {}): EdgePathTestProps {
  return {
    id: edge.id,
    data: { edge },
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 0,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    styleConfig: EDGE_STYLE[edge.type],
    ...overrides,
  } as never;
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/**
 * Fake SVG geometry: a 100-unit horizontal path, x = length travelled.
 * The mock `BaseEdge` renders a plain `<path>` which jsdom constructs as an
 * HTML element, so the geometry methods are installed on that element's
 * constructor prototype (mirroring SVGPathElement in real browsers).
 */
function mockPathGeometry(): { getPointAtLength: ReturnType<typeof vi.fn> } {
  const probe = document.createElement('path');
  const proto = (probe.constructor as unknown as { prototype: object }).prototype;
  const getPointAtLength = vi.fn((length: number) => ({ x: length, y: 0 }));
  Object.defineProperty(proto, 'getPointAtLength', {
    configurable: true,
    value: getPointAtLength,
  });
  Object.defineProperty(proto, 'getTotalLength', {
    configurable: true,
    value: () => 100,
  });
  return { getPointAtLength };
}

function restorePathGeometry(): void {
  const probe = document.createElement('path');
  const proto = (
    probe.constructor as unknown as {
      prototype: Record<string, unknown>;
    }
  ).prototype;
  delete proto.getPointAtLength;
  delete proto.getTotalLength;
}

describe('EdgePath token animation (REQ-VV-007)', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'performance',
        'Date',
      ],
    });
    mockPathGeometry();
  });

  afterEach(() => {
    restorePathGeometry();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('travels a token circle along the edge path when an animationToken arrives', () => {
    const edge = makeEdge();
    render(<EdgePath {...makeProps(edge)} animationToken="t1" />);

    // The token is created imperatively (not part of the initial React tree).
    expect(screen.getByTestId(`token-circle-${edge.id}`)).toBeInTheDocument();

    advance(TOKEN_TRAVEL_MS / 2);
    expect(screen.getByTestId(`token-circle-${edge.id}`).getAttribute('cx')).toBe('50');
    expect(screen.getByTestId(`token-circle-${edge.id}`).getAttribute('cy')).toBe('0');

    advance(TOKEN_TRAVEL_MS / 2);
    expect(screen.getByTestId(`token-circle-${edge.id}`).getAttribute('cx')).toBe('100');
  });

  it('mutates the same DOM node across frames instead of re-rendering it', () => {
    const edge = makeEdge();
    render(<EdgePath {...makeProps(edge)} animationToken="t1" />);

    advance(200);
    const first = screen.getByTestId(`token-circle-${edge.id}`);
    const firstCx = Number(first.getAttribute('cx'));

    advance(200);
    const second = screen.getByTestId(`token-circle-${edge.id}`);

    expect(second).toBe(first);
    expect(Number(second.getAttribute('cx'))).toBeGreaterThan(firstCx);
  });

  it('restarts the travel from the start when the animationToken changes', () => {
    const edge = makeEdge();
    const { rerender } = render(<EdgePath {...makeProps(edge)} animationToken="t1" />);

    advance(TOKEN_TRAVEL_MS / 2);
    expect(screen.getByTestId(`token-circle-${edge.id}`).getAttribute('cx')).toBe('50');

    rerender(<EdgePath {...makeProps(edge)} animationToken="t2" />);
    advance(200);

    // ~25% into the second travel (rAF advances in 16ms frames, so the last
    // frame inside 200ms lands at 192ms → 24%).
    const cx = Number(screen.getByTestId(`token-circle-${edge.id}`).getAttribute('cx'));
    expect(cx).toBeGreaterThanOrEqual(24);
    expect(cx).toBeLessThanOrEqual(25);
  });

  it('keeps an in-flight travel running when re-rendered with the same token', () => {
    const edge = makeEdge();
    const { rerender } = render(<EdgePath {...makeProps(edge)} animationToken="t1" />);

    advance(TOKEN_TRAVEL_MS / 2); // 50%
    rerender(<EdgePath {...makeProps(edge)} animationToken="t1" />);
    advance(200); // +24% → ~74% (16ms frame quantization)

    const cx = Number(screen.getByTestId(`token-circle-${edge.id}`).getAttribute('cx'));
    expect(cx).toBeGreaterThanOrEqual(74);
    expect(cx).toBeLessThanOrEqual(75);
  });

  it('removes the token circle when the animationToken is cleared', () => {
    const edge = makeEdge();
    const { rerender } = render(<EdgePath {...makeProps(edge)} animationToken="t1" />);

    advance(100);
    expect(screen.getByTestId(`token-circle-${edge.id}`)).toBeInTheDocument();

    rerender(<EdgePath {...makeProps(edge)} animationToken={null} />);
    advance(50);

    expect(screen.queryByTestId(`token-circle-${edge.id}`)).not.toBeInTheDocument();
  });

  it('cancels the animation loop when the edge unmounts (culling, REQ-VV-004)', () => {
    const edge = makeEdge();
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
    const { unmount } = render(<EdgePath {...makeProps(edge)} animationToken="t1" />);

    advance(100);
    const framesWhileMounted = rafSpy.mock.calls.length;
    expect(framesWhileMounted).toBeGreaterThan(0);

    unmount();

    expect(cancelSpy).toHaveBeenCalled();
    advance(500);
    expect(rafSpy.mock.calls.length).toBe(framesWhileMounted);
  });

  it('uses the style accent color for the traveling token', () => {
    const edge = makeEdge();
    render(<EdgePath {...makeProps(edge)} animationToken="t1" />);

    expect(screen.getByTestId(`token-circle-${edge.id}`).getAttribute('fill')).toBe(
      EDGE_STYLE[EdgeType.INVOKES].color,
    );
  });

  it('reads the animation token from the edge data when no prop is passed (flow controller path)', () => {
    const edge = { ...makeEdge(), properties: { animationToken: 'flow-run#0' } };
    render(<EdgePath {...makeProps(edge)} />);

    advance(TOKEN_TRAVEL_MS / 2);

    expect(screen.getByTestId(`token-circle-${edge.id}`).getAttribute('cx')).toBe('50');
  });
});
