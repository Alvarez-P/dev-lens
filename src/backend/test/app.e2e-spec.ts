import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /v1/ should return API info', () => {
    return request(app.getHttpServer())
      .get('/v1')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('name', 'DevLens API');
        expect(res.body).toHaveProperty('version', '0.1.0');
      });
  });

  it('GET /health/live should return ok', () => {
    return request(app.getHttpServer())
      .get('/health/live')
      .expect(200)
      .expect({ status: 'ok' });
  });
});
