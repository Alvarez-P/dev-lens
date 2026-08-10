import { Observable } from 'rxjs';
import { AIProvider } from '@/modules/ai/domain/ai-provider.interface';
import {
  AIRequest,
  AIResponse,
  AIChunk,
  AIEnrichmentRequest,
  AIEnrichmentResponse,
} from '@/modules/ai/domain/ai-request.vo';

class FakeProvider implements AIProvider {
  readonly id = 'fake-provider';
  readonly name = 'Fake Provider';
  readonly supportedModels: string[] = ['fake-model'];

  complete(req: AIRequest): Promise<AIResponse> {
    return Promise.resolve({
      content: 'ok',
      model: 'fake',
      tokensUsed: { input: 1, output: 1 },
      finishReason: 'stop',
    });
  }

  streamComplete(req: AIRequest): Observable<AIChunk> {
    return new Observable<AIChunk>();
  }

  healthCheck(): Promise<boolean> {
    return Promise.resolve(true);
  }

  estimateCost(req: AIRequest): number {
    return 0;
  }

  enrich(req: AIEnrichmentRequest): Promise<AIEnrichmentResponse> {
    return Promise.resolve({
      framework: 'nestjs',
      architecture: 'mvc',
      confidence: 1,
      classes: [],
    });
  }
}

describe('AIProvider interface', () => {
  it('should require complete, streamComplete, healthCheck, estimateCost, and enrich', () => {
    const provider: AIProvider = new FakeProvider();

    expect(typeof provider.complete).toBe('function');
    expect(typeof provider.streamComplete).toBe('function');
    expect(typeof provider.healthCheck).toBe('function');
    expect(typeof provider.estimateCost).toBe('function');
    expect(typeof provider.enrich).toBe('function');
  });

  it('should require id, name, and supportedModels metadata for routing', () => {
    const provider: AIProvider = new FakeProvider();

    expect(provider.id).toBe('fake-provider');
    expect(provider.name).toBe('Fake Provider');
    expect(provider.supportedModels).toEqual(['fake-model']);
  });

  it('should return an Observable from streamComplete', async () => {
    const provider: AIProvider = new FakeProvider();

    const stream = provider.streamComplete({ messages: [] });
    expect(stream).toBeInstanceOf(Observable);
  });

  it('should resolve a typed AIEnrichmentResponse from enrich', async () => {
    const provider: AIProvider = new FakeProvider();

    const response = await provider.enrich({
      messages: [],
      capability: 'classify-lifecycle',
      framework: 'nestjs',
      manifestSha256: 'abc123',
    });

    expect(response.classes).toEqual([]);
    expect(response.framework).toBe('nestjs');
  });
});
