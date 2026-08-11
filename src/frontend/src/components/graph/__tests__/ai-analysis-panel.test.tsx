import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { NodeType } from '@/lib/visualization/types';
import type { GraphNode } from '@/lib/visualization/types';
import { AIAnalysisPanel } from '../ai-analysis-panel';
import { stream } from '@/lib/api-client';
import type { AIChunk } from '@/lib/api-client';
import { useAIStore } from '@/lib/store/ai-store';
import type { AIStore } from '@/lib/store/ai-store';

// Isolate the component: control the AI store state and the SSE client.
vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, stream: vi.fn() };
});

vi.mock('@/lib/store/ai-store', async () => {
  const { create } = await import('zustand');
  return {
    useAIStore: create<AIStore>((set) => ({
      chunks: [],
      status: 'idle',
      errorMessage: null,
      appendChunk: (content: string) =>
        set((state) => ({ chunks: [...state.chunks, content], status: 'streaming' })),
      setDone: () => set({ status: 'done' }),
      setError: (message: string) => set({ status: 'error', errorMessage: message }),
      reset: () => set({ chunks: [], status: 'idle', errorMessage: null }),
    })),
  };
});

const streamMock = vi.mocked(stream);

const serviceNode: GraphNode = {
  id: 'n1',
  type: NodeType.SERVICE,
  label: 'AuthService',
  fqn: 'my-pkg/AuthService',
  properties: {},
  repoId: 'repo-1',
  version: 3,
  deprecatedAt: null,
};

const otherNode: GraphNode = {
  id: 'n2',
  type: NodeType.CONTROLLER,
  label: 'AuthController',
  fqn: 'my-pkg/AuthController',
  properties: {},
  repoId: 'repo-1',
  version: 3,
  deprecatedAt: null,
};

/** A ReadableStream whose chunks are enqueued manually (progressive tokens). */
function manualStream(): {
  stream: ReadableStream<AIChunk>;
  enqueue: (chunk: AIChunk) => void;
  close: () => void;
} {
  let controller!: ReadableStreamDefaultController<AIChunk>;
  const stream = new ReadableStream<AIChunk>({
    start(c) {
      controller = c;
    },
  });
  return {
    stream,
    enqueue: (chunk) => controller.enqueue(chunk),
    close: () => controller.close(),
  };
}

/** A ReadableStream that delivers all chunks then closes (normal SSE completion). */
function fixedStream(chunks: AIChunk[]): ReadableStream<AIChunk> {
  return new ReadableStream<AIChunk>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

beforeEach(() => {
  useAIStore.setState({
    chunks: [],
    status: 'idle',
    errorMessage: null,
    appendChunk: useAIStore.getState().appendChunk,
    setDone: useAIStore.getState().setDone,
    setError: useAIStore.getState().setError,
    reset: useAIStore.getState().reset,
  });
  streamMock.mockReset();
});

describe('AIAnalysisPanel — idle state', () => {
  it('renders the section header and an Analyze with AI button when idle', () => {
    render(<AIAnalysisPanel node={serviceNode} />);

    expect(screen.getByRole('heading', { name: 'AI Analysis' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyze with ai/i })).toBeInTheDocument();
  });

  it('calls stream() with the explain-module capability, repoId and node FQN', async () => {
    const manual = manualStream();
    streamMock.mockReturnValue({ stream: manual.stream, abort: vi.fn() });

    render(<AIAnalysisPanel node={serviceNode} />);
    fireEvent.click(screen.getByRole('button', { name: /analyze with ai/i }));

    await waitFor(() => {
      expect(streamMock).toHaveBeenCalledWith('/api/v1/ai/stream', {
        capability: 'explain-module',
        repoId: 'repo-1',
        nodeId: 'my-pkg/AuthService',
      });
    });
  });
});

describe('AIAnalysisPanel — streaming', () => {
  it('appends token chunks progressively to the visible text', async () => {
    const manual = manualStream();
    streamMock.mockReturnValue({ stream: manual.stream, abort: vi.fn() });

    render(<AIAnalysisPanel node={serviceNode} />);
    fireEvent.click(screen.getByRole('button', { name: /analyze with ai/i }));

    await act(async () => {
      manual.enqueue({ type: 'token', content: 'The ' });
    });

    const output = screen.getByTestId('ai-analysis-output');
    expect(output).toHaveTextContent('The');
    expect(output).not.toHaveTextContent('OrderService');

    await act(async () => {
      manual.enqueue({ type: 'token', content: 'OrderService' });
    });

    expect(output).toHaveTextContent('The OrderService');
  });

  it('shows a Stop button while streaming and aborts the stream when clicked', async () => {
    const manual = manualStream();
    const abort = vi.fn();
    streamMock.mockReturnValue({ stream: manual.stream, abort });

    render(<AIAnalysisPanel node={serviceNode} />);
    fireEvent.click(screen.getByRole('button', { name: /analyze with ai/i }));

    await act(async () => {
      manual.enqueue({ type: 'token', content: 'partial' });
    });

    const stopButton = screen.getByRole('button', { name: /stop/i });
    expect(stopButton).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /analyze with ai/i })).not.toBeInTheDocument();

    fireEvent.click(stopButton);

    expect(abort).toHaveBeenCalledTimes(1);
    expect(useAIStore.getState().status).toBe('idle');
    expect(useAIStore.getState().chunks).toEqual([]);
    expect(screen.getByRole('button', { name: /analyze with ai/i })).toBeInTheDocument();
  });
});

describe('AIAnalysisPanel — completion', () => {
  it('marks the stream done and shows the full text without streaming controls', async () => {
    streamMock.mockReturnValue({
      stream: fixedStream([
        { type: 'token', content: 'AuthService ' },
        { type: 'token', content: 'depends on AuthRepository' },
        { type: 'done', content: '', tokens: 3, model: 'mock-model' },
      ]),
      abort: vi.fn(),
    });

    render(<AIAnalysisPanel node={serviceNode} />);
    fireEvent.click(screen.getByRole('button', { name: /analyze with ai/i }));

    await waitFor(() => expect(useAIStore.getState().status).toBe('done'));

    expect(screen.getByTestId('ai-analysis-output')).toHaveTextContent(
      'AuthService depends on AuthRepository',
    );
    expect(screen.queryByRole('button', { name: /stop/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /analyze with ai/i })).not.toBeInTheDocument();
  });
});

describe('AIAnalysisPanel — error state', () => {
  it('renders the error message in a destructive container', async () => {
    streamMock.mockReturnValue({
      stream: fixedStream([
        { type: 'error', content: 'AI provider unavailable', code: 'PROVIDER_UNAVAILABLE' },
      ]),
      abort: vi.fn(),
    });

    render(<AIAnalysisPanel node={serviceNode} />);
    fireEvent.click(screen.getByRole('button', { name: /analyze with ai/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('AI provider unavailable');
    expect(useAIStore.getState().status).toBe('error');
  });
});

describe('AIAnalysisPanel — lifecycle', () => {
  it('aborts the in-flight stream and resets the store when the node changes', async () => {
    const manual = manualStream();
    const abort = vi.fn();
    streamMock.mockReturnValue({ stream: manual.stream, abort });

    const { rerender } = render(<AIAnalysisPanel node={serviceNode} />);
    fireEvent.click(screen.getByRole('button', { name: /analyze with ai/i }));

    await act(async () => {
      manual.enqueue({ type: 'token', content: 'partial' });
    });
    expect(useAIStore.getState().status).toBe('streaming');

    rerender(<AIAnalysisPanel node={otherNode} />);

    expect(abort).toHaveBeenCalledTimes(1);
    expect(useAIStore.getState().status).toBe('idle');
    expect(useAIStore.getState().chunks).toEqual([]);
  });

  it('aborts and resets when the panel unmounts mid-stream', async () => {
    const manual = manualStream();
    const abort = vi.fn();
    streamMock.mockReturnValue({ stream: manual.stream, abort });

    const { unmount } = render(<AIAnalysisPanel node={serviceNode} />);
    fireEvent.click(screen.getByRole('button', { name: /analyze with ai/i }));

    await act(async () => {
      manual.enqueue({ type: 'token', content: 'partial' });
    });

    unmount();

    expect(abort).toHaveBeenCalledTimes(1);
    expect(useAIStore.getState().status).toBe('idle');
  });
});
