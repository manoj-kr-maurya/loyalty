import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Engines (e2e)', () => {
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

  describe('FX Engine', () => {
    it('POST /engines/fx/convert - should convert currency', () => {
      return request(app.getHttpServer())
        .post('/engines/fx/convert')
        .send({
          fromCurrency: 'USD',
          toCurrency: 'INR',
          amount: 100,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toBeDefined();
        });
    });

    it('GET /engines/fx/historical-rates/USD - should get historical rates', () => {
      return request(app.getHttpServer())
        .get('/engines/fx/historical-rates/USD')
        .expect(200);
    });
  });

  describe('Loyalty Engine', () => {
    it('GET /engines/loyalty/tiers/test-org-id - should get tiers', () => {
      return request(app.getHttpServer())
        .get('/engines/loyalty/tiers/test-org-id')
        .expect(200);
    });

    it('GET /engines/loyalty/tier-status/test-customer-id/test-org-id - should get tier status', () => {
      return request(app.getHttpServer())
        .get('/engines/loyalty/tier-status/test-customer-id/test-org-id')
        .expect(200);
    });
  });

  describe('Promo Engine', () => {
    it('POST /engines/promo/validate - should validate promo code', () => {
      return request(app.getHttpServer())
        .post('/engines/promo/validate')
        .send({
          code: 'TEST10',
          customerId: 'test-customer-id',
          organizationId: 'test-org-id',
        })
        .expect(200);
    });

    it('GET /engines/promo/redemptions/test-customer-id/test-org-id - should get redemption history', () => {
      return request(app.getHttpServer())
        .get('/engines/promo/redemptions/test-customer-id/test-org-id')
        .expect(200);
    });
  });

  describe('PLB Engine', () => {
    it('GET /engines/plb/programs/test-org-id - should get PLB programs', () => {
      return request(app.getHttpServer())
        .get('/engines/plb/programs/test-org-id')
        .expect(200);
    });
  });

  describe('Value Exchange Engine', () => {
    it('GET /engines/value-exchange/agreements/source-1 - should get agreements', () => {
      return request(app.getHttpServer())
        .get('/engines/value-exchange/agreements/source-1')
        .expect(200);
    });

    it('GET /engines/value-exchange/orders/test-customer-id/test-entity-id - should get order history', () => {
      return request(app.getHttpServer())
        .get('/engines/value-exchange/orders/test-customer-id/test-entity-id')
        .expect(200);
    });
  });
});
