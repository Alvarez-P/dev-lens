import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useGraphStore } from '@/lib/visualization/store/graph-store';
import type { GraphStore } from '@/lib/visualization/store/graph-store';
import { EdgeType } from '@/lib/visualization/types';
import type { RequestFlowStep } from '@/lib/visualization/types';
import { useFlowAnimation, FLOW_STEP_INTERVAL_MS } from '../use-flow-animation';

function makeStep(order: number): RequestFlowStep {
  return {
    order,
    kind: order === 3 ? 'handler' : 'guard',
    nodeFqn: `fqn#${order}`,
    nodeLabel: `Step ${order}`,
    edgeType: EdgeType.PROTECTS,
    payloadType: null,
    approximate: false,
  };
}

const initialState: GraphStore = useGraphStore.getState();

describe('useFlowAnimation (REQ-VV-007 playback controller)', () => {
  beforeEach(() => {
    useGraphStore.setState(initialState, true);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('advances through the steps while playing and pauses after the final step', () => {
    renderHook(() => useFlowAnimation());

    act(() => {
      useGraphStore.getState().startFlow('ep#1', [makeStep(1), makeStep(2), makeStep(3)]);
    });
    expect(useGraphStore.getState().currentStepIndex).toBe(0);
    expect(useGraphStore.getState().isPlaying).toBe(true);

    act(() => {
      vi.advanceTimersByTime(FLOW_STEP_INTERVAL_MS);
    });
    expect(useGraphStore.getState().currentStepIndex).toBe(1);

    act(() => {
      vi.advanceTimersByTime(FLOW_STEP_INTERVAL_MS);
    });
    expect(useGraphStore.getState().currentStepIndex).toBe(2);

    // Final step reached: one more interval lets the last token travel finish,
    // then playback stops (animation-complete stop handed off from PR 3).
    act(() => {
      vi.advanceTimersByTime(FLOW_STEP_INTERVAL_MS);
    });
    expect(useGraphStore.getState().currentStepIndex).toBe(2);
    expect(useGraphStore.getState().isPlaying).toBe(false);
  });

  it('does not advance while paused', () => {
    renderHook(() => useFlowAnimation());

    act(() => {
      useGraphStore.getState().startFlow('ep#1', [makeStep(1), makeStep(2)]);
      useGraphStore.getState().pauseFlow();
    });

    act(() => {
      vi.advanceTimersByTime(FLOW_STEP_INTERVAL_MS * 3);
    });

    expect(useGraphStore.getState().currentStepIndex).toBe(0);
    expect(useGraphStore.getState().isPlaying).toBe(false);
  });

  it('does nothing when no flow is loaded', () => {
    renderHook(() => useFlowAnimation());

    act(() => {
      vi.advanceTimersByTime(FLOW_STEP_INTERVAL_MS * 3);
    });

    expect(useGraphStore.getState().currentStepIndex).toBe(0);
    expect(useGraphStore.getState().isPlaying).toBe(false);
  });

  it('scales the step interval by animationSpeed', () => {
    useGraphStore.setState({ animationSpeed: 2 });
    renderHook(() => useFlowAnimation());

    act(() => {
      useGraphStore.getState().startFlow('ep#1', [makeStep(1), makeStep(2)]);
    });

    act(() => {
      vi.advanceTimersByTime(FLOW_STEP_INTERVAL_MS / 2);
    });

    expect(useGraphStore.getState().currentStepIndex).toBe(1);
  });

  it('stops advancing when the flow is reset mid-play', () => {
    renderHook(() => useFlowAnimation());

    act(() => {
      useGraphStore.getState().startFlow('ep#1', [makeStep(1), makeStep(2), makeStep(3)]);
      useGraphStore.getState().resetFlow();
    });

    act(() => {
      vi.advanceTimersByTime(FLOW_STEP_INTERVAL_MS * 3);
    });

    expect(useGraphStore.getState().currentStepIndex).toBe(0);
    expect(useGraphStore.getState().isPlaying).toBe(false);
  });

  it('stays cleared after pause then reset — no pending timer revives playback', () => {
    renderHook(() => useFlowAnimation());

    act(() => {
      useGraphStore.getState().startFlow('ep#1', [makeStep(1), makeStep(2), makeStep(3)]);
      useGraphStore.getState().nextStep();
      useGraphStore.getState().pauseFlow();
      useGraphStore.getState().resetFlow();
    });

    act(() => {
      vi.advanceTimersByTime(FLOW_STEP_INTERVAL_MS * 3);
    });

    expect(useGraphStore.getState().currentStepIndex).toBe(0);
    expect(useGraphStore.getState().isPlaying).toBe(false);
  });
});
