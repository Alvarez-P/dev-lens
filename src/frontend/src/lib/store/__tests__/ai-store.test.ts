import { describe, it, expect, beforeEach } from 'vitest';
import { useAIStore } from '../ai-store';
import type { AIStore } from '../ai-store';

const initialState: AIStore = useAIStore.getState();

beforeEach(() => {
  // Restore pristine state (actions included) before every test.
  useAIStore.setState(initialState, true);
});

describe('initial state', () => {
  it('starts idle with no chunks and no error message', () => {
    const state = useAIStore.getState();

    expect(state.chunks).toEqual([]);
    expect(state.status).toBe('idle');
    expect(state.errorMessage).toBeNull();
  });
});

describe('appendChunk', () => {
  it('appends a chunk and switches status to streaming', () => {
    useAIStore.getState().appendChunk('The');

    const state = useAIStore.getState();
    expect(state.chunks).toEqual(['The']);
    expect(state.status).toBe('streaming');
  });

  it('accumulates chunks in arrival order', () => {
    useAIStore.getState().appendChunk('The');
    useAIStore.getState().appendChunk(' OrderService');
    useAIStore.getState().appendChunk(' orchestrates');

    expect(useAIStore.getState().chunks).toEqual(['The', ' OrderService', ' orchestrates']);
  });
});

describe('setDone', () => {
  it('marks the stream done while keeping the accumulated chunks', () => {
    useAIStore.getState().appendChunk('complete text');
    useAIStore.getState().setDone();

    const state = useAIStore.getState();
    expect(state.status).toBe('done');
    expect(state.chunks).toEqual(['complete text']);
    expect(state.errorMessage).toBeNull();
  });
});

describe('setError', () => {
  it('marks the stream as errored and stores the message', () => {
    useAIStore.getState().setError('AI provider unavailable');

    const state = useAIStore.getState();
    expect(state.status).toBe('error');
    expect(state.errorMessage).toBe('AI provider unavailable');
  });
});

describe('reset', () => {
  it('clears chunks and the error message and returns to idle', () => {
    useAIStore.getState().appendChunk('partial');
    useAIStore.getState().setError('boom');

    useAIStore.getState().reset();

    const state = useAIStore.getState();
    expect(state.chunks).toEqual([]);
    expect(state.status).toBe('idle');
    expect(state.errorMessage).toBeNull();
  });
});

describe('status transitions', () => {
  it('transitions idle → streaming → done', () => {
    expect(useAIStore.getState().status).toBe('idle');

    useAIStore.getState().appendChunk('x');
    expect(useAIStore.getState().status).toBe('streaming');

    useAIStore.getState().setDone();
    expect(useAIStore.getState().status).toBe('done');
  });

  it('transitions streaming → error and recovers via reset', () => {
    useAIStore.getState().appendChunk('x');
    expect(useAIStore.getState().status).toBe('streaming');

    useAIStore.getState().setError('failed');
    expect(useAIStore.getState().status).toBe('error');

    useAIStore.getState().reset();
    expect(useAIStore.getState().status).toBe('idle');
  });
});
