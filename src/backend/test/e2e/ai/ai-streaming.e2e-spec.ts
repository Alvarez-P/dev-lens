import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { request as httpRequest } from 'http';
import { IncomingMessage } from 'http';
import { AddressInfo } from 'net';
import { of, Subject } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { AIController } from '@/modules/ai/infrastructure/controllers/ai.controller';
import { AIService } from '@/modules/ai/application/ai.service';
import { AIChunk } from '@/modules/ai/domain/ai-request.vo';

interface ParsedSseEvent {
  id?: string;
  data: unknown;
}

/** Parses the W3C event-stream payload (id:/data: lines) into structured events. */
function parseSse(body: string): ParsedSseEvent[] {
  const events: ParsedSseEvent[] = [];
  let current: { id?: string; dataLines: string[] } | null = null;

  for (const line of body.split('\n')) {
    if (line.startsWith('id:')) {
      current = current ?? { dataLines: [] };
      current.id = line.slice(3).trim();
      continue;
    }
    if (line.startsWith('data:')) {
      current = current ?? { dataLines: [] };
      current.dataLines.push(line.slice(5).trim());
      continue;
    }
    if (line === '' && current !== null) {
      events.push({ id: current.id, data: JSON.parse(current.dataLines.join('\n')) });
      current = null;
    }
  }

  return events;
}

async function waitFor(condition: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitFor timed out');
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

describe('AI SSE streaming endpoint (PR13 task 4.2)', () => {
  let app: INestApplication;
  let enrich: jest.Mock;

  const streamPath = (overrides?: Record<string, string>): string => {
    const params = {
      capability: 'explain-module',
      repoId: 'repo-1',
      nodeId: 'src/orders/OrderService.ts',
      ...overrides,
    };
    const qs = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    return `/ai/stream?${qs}`;
  };

  beforeAll(async () => {
    enrich = jest.fn();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AIController],
      providers: [{ provide: AIService, useValue: { enrich } }],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    await app.listen(0);
  });

  afterAll(async () => {
    // Destroy idle keep-alive sockets first — supertest reuses Node's
    // globalAgent (keepAlive: true on Node 22), which would otherwise make
    // server.close() wait forever and force-exit the jest worker.
    const httpServer = app.getHttpServer();
    if (typeof httpServer.closeAllConnections === 'function') {
      httpServer.closeAllConnections();
    }
    await app.close();
  });

  beforeEach(() => {
    enrich.mockReset();
  });

  it('should stream token chunks then a done chunk as text/event-stream', async () => {
    enrich.mockReturnValueOnce(
      of(
        { type: 'token', content: 'The' },
        { type: 'token', content: ' OrderService' },
        { type: 'done', content: '', tokens: 2, model: 'gpt-4o' },
      ),
    );

    const res = await request(app.getHttpServer()).get(streamPath());

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.headers['cache-control']).toContain('no-cache');

    const events = parseSse(res.text);
    expect(events.map((event) => event.data)).toEqual([
      { type: 'token', content: 'The' },
      { type: 'token', content: ' OrderService' },
      { type: 'done', content: '', tokens: 2, model: 'gpt-4o' },
    ]);
    expect(enrich).toHaveBeenCalledWith('explain-module', 'repo-1', 'src/orders/OrderService.ts');
  });

  it('should render every event as a JSON data line terminated by a blank line', async () => {
    enrich.mockReturnValueOnce(of({ type: 'token', content: 'Hi' }));

    const res = await request(app.getHttpServer()).get(streamPath());

    expect(res.text).toContain('data: {"type":"token","content":"Hi"}\n\n');
    const nonBlankLines = res.text.split('\n').filter((line) => line.length > 0);
    expect(nonBlankLines.length).toBeGreaterThan(0);
    for (const line of nonBlankLines) {
      expect(line.startsWith('id: ') || line.startsWith('data: ')).toBe(true);
    }
  });

  it('should emit a sanitized validation error chunk and complete when capability is missing', async () => {
    const res = await request(app.getHttpServer()).get(streamPath({ capability: '' }));

    expect(res.status).toBe(200);
    const events = parseSse(res.text);
    expect(events).toHaveLength(1);
    expect(events[0].data).toEqual({
      type: 'error',
      content: 'Missing required query parameter "capability"',
      code: 'INVALID_PARAMS',
    });
    expect(enrich).not.toHaveBeenCalled();
  });

  it('should emit a sanitized validation error chunk when nodeId is missing', async () => {
    const res = await request(app.getHttpServer()).get(streamPath({ nodeId: '' }));

    const events = parseSse(res.text);
    expect(events).toHaveLength(1);
    expect(events[0].data).toEqual({
      type: 'error',
      content: 'Missing required query parameter "nodeId"',
      code: 'INVALID_PARAMS',
    });
    expect(enrich).not.toHaveBeenCalled();
  });

  it('should sanitize capability-not-found so the raw message never reaches the client', async () => {
    enrich.mockReturnValueOnce(
      of({
        type: 'error',
        content: 'AI capability "ghost-capability" is not registered',
        code: 'CAPABILITY_NOT_FOUND',
      }),
    );

    const res = await request(app.getHttpServer()).get(streamPath());

    const events = parseSse(res.text);
    expect(events).toHaveLength(1);
    expect(events[0].data).toEqual({
      type: 'error',
      content: 'Capability not found',
      code: 'CAPABILITY_NOT_FOUND',
    });
    expect(res.text).not.toContain('ghost-capability');
    expect(res.text).not.toContain('is not registered');
  });

  it('should sanitize provider authentication failures so API keys never leak', async () => {
    enrich.mockReturnValueOnce(
      of({
        type: 'error',
        content: '401 invalid api key sk-proj-secret-1234',
        code: 'AI_AUTHENTICATION',
      }),
    );

    const res = await request(app.getHttpServer()).get(streamPath());

    const events = parseSse(res.text);
    expect(events).toHaveLength(1);
    expect(events[0].data).toEqual({
      type: 'error',
      content: 'Authentication failed',
      code: 'AI_AUTHENTICATION',
    });
    expect(res.text).not.toContain('sk-proj-secret-1234');
  });

  it('should abort the provider stream when the client disconnects mid-stream', async () => {
    const abortSpy = jest.fn();
    const subject = new Subject<AIChunk>();
    enrich.mockReturnValueOnce(subject.asObservable().pipe(finalize(() => abortSpy())));

    const port = (app.getHttpServer().address() as AddressInfo).port;
    const httpReq = httpRequest({
      host: '127.0.0.1',
      port,
      path: streamPath(),
      method: 'GET',
    });
    httpReq.on('error', () => undefined);
    httpReq.end();

    const response = await new Promise<IncomingMessage>((resolve) =>
      httpReq.on('response', resolve),
    );
    response.on('error', () => undefined);
    let received = '';
    response.on('data', (buf: Buffer) => {
      received += buf.toString();
    });

    // Push a token and wait until it reaches the wire.
    subject.next({ type: 'token', content: 'first-token' });
    await waitFor(() => received.includes('first-token'));

    // Client disconnects (EventSource.close / socket teardown).
    httpReq.destroy();
    await waitFor(() => abortSpy.mock.calls.length > 0);
    expect(abortSpy).toHaveBeenCalledTimes(1);

    // Anything pushed after teardown must never reach the client.
    subject.next({ type: 'token', content: 'after-abort' });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(received).not.toContain('after-abort');
  });
});
