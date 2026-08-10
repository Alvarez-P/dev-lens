import { useEffect } from 'react';
import { useGraphStore } from '@/lib/visualization/store/graph-store';

/**
 * Base time between lifecycle steps at 1x speed. The token travel on each
 * edge is `TOKEN_TRAVEL_DURATION_MS` (800ms); the extra padding lets the
 * token finish before the next step starts.
 */
export const FLOW_STEP_INTERVAL_MS = 1000;

/**
 * Flow playback controller (REQ-VV-007 / REQ-VV-008). While a flow is
 * playing, advances `currentStepIndex` on a timer scaled by `animationSpeed`
 * and pauses playback after the final step's token travel (the
 * animation-complete stop handed off from PR 3). Clears its timer whenever
 * playback stops or the flow is reset.
 */
export function useFlowAnimation(): void {
  const flowSteps = useGraphStore((state) => state.flowSteps);
  const currentStepIndex = useGraphStore((state) => state.currentStepIndex);
  const isPlaying = useGraphStore((state) => state.isPlaying);
  const animationSpeed = useGraphStore((state) => state.animationSpeed);
  const nextStep = useGraphStore((state) => state.nextStep);
  const pauseFlow = useGraphStore((state) => state.pauseFlow);

  useEffect(() => {
    if (!isPlaying || flowSteps.length === 0) {
      return;
    }

    const interval = FLOW_STEP_INTERVAL_MS / animationSpeed;

    if (currentStepIndex >= flowSteps.length - 1) {
      const timer = window.setTimeout(() => pauseFlow(), interval);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => nextStep(), interval);
    return () => window.clearTimeout(timer);
  }, [isPlaying, flowSteps.length, currentStepIndex, animationSpeed, nextStep, pauseFlow]);
}
