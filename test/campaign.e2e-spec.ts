import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Campaign (e2e)', () => {
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

  describe('Campaign Operations (without auth - should fail)', () => {
    it('POST /campaign/create-organization-level-campaign - should reject without JWT', () => {
      return request(app.getHttpServer())
        .post('/campaign/create-organization-level-campaign')
        .send({
          name: 'Test Campaign',
          earningPercentage: 5,
          currencyCode: 'PTS',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          earningExpiresIn: 30,
        })
        .expect(401);
    });

    it('GET /campaign/get-organization-level-campaigns - should reject without JWT', () => {
      return request(app.getHttpServer())
        .get('/campaign/get-organization-level-campaigns')
        .expect(401);
    });
  });
});
