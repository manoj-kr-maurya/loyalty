import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Admin (e2e)', () => {
  let app: INestApplication;
  const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'gyhewd8x34y87ddsyn9738t94587rfybds09t478fts7ndyr7yfd0gyn7t';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe('Admin API Key Authentication', () => {
    it('GET /admin/fetch-all-organizations - should reject without API key', () => {
      return request(app.getHttpServer())
        .get('/admin/fetch-all-organizations')
        .expect(401);
    });

    it('GET /admin/fetch-all-organizations - should reject with invalid API key', () => {
      return request(app.getHttpServer())
        .get('/admin/fetch-all-organizations')
        .set('x-api-key', 'invalid-key')
        .expect(401);
    });

    it('GET /admin/fetch-all-customers - should reject without API key', () => {
      return request(app.getHttpServer())
        .get('/admin/fetch-all-customers')
        .expect(401);
    });
  });

  describe('Admin Endpoints (with API key)', () => {
    it('GET /admin/fetch-all-organizations - should return paginated list', () => {
      return request(app.getHttpServer())
        .get('/admin/fetch-all-organizations')
        .set('x-api-key', ADMIN_API_KEY)
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('Success');
          expect(res.body.data).toBeDefined();
        });
    });

    it('GET /admin/fetch-all-customers - should return paginated list', () => {
      return request(app.getHttpServer())
        .get('/admin/fetch-all-customers')
        .set('x-api-key', ADMIN_API_KEY)
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('Success');
          expect(res.body.data).toBeDefined();
        });
    });
  });
});
