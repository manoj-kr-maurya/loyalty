import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Currency (e2e)', () => {
  let app: INestApplication;

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

  describe('Currency Operations (without auth - should fail)', () => {
    it('POST /currency/create - should reject without JWT', () => {
      return request(app.getHttpServer())
        .post('/currency/create')
        .send({ currencyCode: 'PTS', name: 'Points' })
        .expect(401);
    });

    it('GET /currency/get-organization-currency-buckets - should reject without JWT', () => {
      return request(app.getHttpServer())
        .get('/currency/get-organization-currency-buckets')
        .expect(401);
    });
  });
});
