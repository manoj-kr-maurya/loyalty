import { INestApplication, Module } from '@nestjs/common';
import { APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { TenantScopeInterceptor } from 'src/interceptors/tenant/tenant-scope.interceptor';
import { ApiKeyService } from 'src/modules/auth/api-key.service';
import { OrganizationApiKeyGuard } from 'src/modules/auth/guards/organization-api-key.guard';
import { ScopesGuard } from 'src/modules/auth/guards/scopes.guard';
import { PromoController } from 'src/modules/promo/api/promo.controller';
import { PromoEngineController } from 'src/modules/promo/api/promo-engine.controller';
import { PromoService } from 'src/modules/promo/application/promo.service';
import { PromoCodeService } from 'src/modules/promo/application/promo-code.service';
import { CouponCodeService } from 'src/modules/promo/coupon-code.service';

const ORG_ONE = 'org-1';
const ORG_TWO = 'org-2';

@Module({
  controllers: [PromoController, PromoEngineController],
  providers: [
    {
      provide: PromoService,
      useValue: {
        createAndPersistPromotion: jest.fn(),
        evaluatePromotions: jest.fn(),
        getActivePromotions: jest.fn(),
        listPromotions: jest.fn(),
        getPromotionById: jest.fn(),
        updatePromotion: jest.fn(),
        upsertRules: jest.fn(),
        checkCouponOnCart: jest.fn(),
        allocateCoupon: jest.fn(),
        blockCoupon: jest.fn(),
        releaseCoupon: jest.fn(),
        claimCoupon: jest.fn(),
        getCustomerCoupons: jest.fn(),
        getCoupon: jest.fn(),
        recordClaim: jest.fn(),
        revokeClaim: jest.fn(),
        getClaimById: jest.fn(),
        getCustomerClaimSummary: jest.fn(),
      },
    },
    {
      provide: CouponCodeService,
      useValue: {
        generateCodes: jest.fn(),
        validateCode: jest.fn(),
        allocateCode: jest.fn(),
        claimCode: jest.fn(),
        listCodes: jest.fn(),
        getCodeByCustomer: jest.fn(),
      },
    },
    {
      provide: PromoCodeService,
      useValue: {
        createPromoCode: jest.fn(),
        validatePromoCode: jest.fn(),
        redeemPromoCode: jest.fn(),
        evaluateStacking: jest.fn(),
        getRedemptionHistory: jest.fn(),
      },
    },
    {
      provide: ConfigService,
      useValue: {
        get: (key: string) =>
          key === 'ADMIN_API_KEY' ? 'platform-key' : undefined,
      },
    },
    {
      provide: ApiKeyService,
      useValue: {
        validate: async (key: string) => {
          if (key === 'org1-key') {
            return {
              type: 'organization',
              organizationId: ORG_ONE,
              scopes: ['promo:read', 'promo:write'],
            };
          }
          if (key === 'org1-read-key') {
            return {
              type: 'organization',
              organizationId: ORG_ONE,
              scopes: ['promo:read'],
            };
          }
          if (key === 'org2-key') {
            return {
              type: 'organization',
              organizationId: ORG_TWO,
              scopes: ['promo:read', 'promo:write'],
            };
          }
          return null;
        },
      },
    },
    OrganizationApiKeyGuard,
    ScopesGuard,
    Reflector,
    { provide: APP_INTERCEPTOR, useClass: TenantScopeInterceptor },
  ],
})
class PromoApiTestModule {}

describe('Promo APIs (e2e)', () => {
  let app: INestApplication;
  let promoService: Record<string, jest.Mock>;
  let couponCodeService: Record<string, jest.Mock>;
  let promoCodeService: Record<string, jest.Mock>;

  const validPromotionBody = {
    organizationId: ORG_ONE,
    name: 'Summer Sale',
    rewardType: 'DISCOUNT',
    validFrom: '2026-01-01T00:00:00.000Z',
    validTo: '2026-12-31T23:59:59.000Z',
  };

  const validPromoCodeBody = {
    organizationId: ORG_ONE,
    code: 'SAVE10',
    name: 'Save 10',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-12-31T23:59:59.000Z',
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PromoApiTestModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    promoService = app.get(PromoService);
    couponCodeService = app.get(CouponCodeService);
    promoCodeService = app.get(PromoCodeService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(promoService).forEach((fn) =>
      fn.mockResolvedValue({ ok: true }),
    );
    Object.values(couponCodeService).forEach((fn) =>
      fn.mockResolvedValue({ ok: true }),
    );
    Object.values(promoCodeService).forEach((fn) =>
      fn.mockResolvedValue({ ok: true }),
    );
    promoService.getCustomerCoupons.mockResolvedValue([]);
    promoService.listPromotions.mockResolvedValue([]);
    couponCodeService.listCodes.mockResolvedValue([]);
    promoCodeService.getRedemptionHistory.mockResolvedValue({
      customerId: 'customer-1',
      organizationId: ORG_ONE,
      totalSaved: 0,
      redemptions: [],
    });
  });

  describe('authentication and tenant isolation', () => {
    it('rejects missing API keys on both surfaces', async () => {
      await request(app.getHttpServer()).get('/promo/list').expect(401);

      await request(app.getHttpServer())
        .get(`/engines/promo/redemptions/customer-1/${ORG_ONE}`)
        .expect(401);
    });

    it('rejects an invalid API key', async () => {
      await request(app.getHttpServer())
        .get('/promo/list')
        .set('x-api-key', 'not-a-key')
        .expect(401);
    });

    it('requires promo:write for write endpoints', async () => {
      await request(app.getHttpServer())
        .post('/engines/promo/codes')
        .set('x-api-key', 'org1-read-key')
        .send(validPromoCodeBody)
        .expect(403);

      expect(promoCodeService.createPromoCode).not.toHaveBeenCalled();
    });

    it('rejects cross-tenant organization references', async () => {
      await request(app.getHttpServer())
        .post('/promo/create')
        .set('x-api-key', 'org1-key')
        .send({ ...validPromotionBody, organizationId: ORG_TWO })
        .expect(403);

      await request(app.getHttpServer())
        .post('/engines/promo/validate')
        .set('x-api-key', 'org1-key')
        .send({
          code: 'SAVE10',
          organizationId: ORG_TWO,
          customerId: 'customer-1',
          orderAmount: 100,
        })
        .expect(403);

      expect(promoService.createAndPersistPromotion).not.toHaveBeenCalled();
      expect(promoCodeService.validatePromoCode).not.toHaveBeenCalled();
    });
  });

  describe('/engines/promo', () => {
    it('POST /codes creates a code', async () => {
      await request(app.getHttpServer())
        .post('/engines/promo/codes')
        .set('x-api-key', 'org1-key')
        .send(validPromoCodeBody)
        .expect(201);

      expect(promoCodeService.createPromoCode).toHaveBeenCalledWith({
        ...validPromoCodeBody,
        startDate: new Date(validPromoCodeBody.startDate),
        endDate: new Date(validPromoCodeBody.endDate),
      });
    });

    it('POST /validate validates a code', async () => {
      const body = {
        code: 'SAVE10',
        organizationId: ORG_ONE,
        customerId: 'customer-1',
        orderAmount: 1000,
      };

      await request(app.getHttpServer())
        .post('/engines/promo/validate')
        .set('x-api-key', 'org1-read-key')
        .send(body)
        .expect(200);

      expect(promoCodeService.validatePromoCode).toHaveBeenCalledWith(body);
    });

    it('POST /redeem redeems a code', async () => {
      const body = {
        code: 'SAVE10',
        organizationId: ORG_ONE,
        customerId: 'customer-1',
        orderAmount: 1000,
        orderRef: 'order-1',
      };

      await request(app.getHttpServer())
        .post('/engines/promo/redeem')
        .set('x-api-key', 'org1-key')
        .send(body)
        .expect(200);

      expect(promoCodeService.redeemPromoCode).toHaveBeenCalledWith(body);
    });

    it('POST /stacking evaluates stackability', async () => {
      const body = {
        codes: ['SAVE10', 'SAVE20'],
        organizationId: ORG_ONE,
        customerId: 'customer-1',
        orderAmount: 1000,
      };

      await request(app.getHttpServer())
        .post('/engines/promo/stacking')
        .set('x-api-key', 'org1-read-key')
        .send(body)
        .expect(200);

      expect(promoCodeService.evaluateStacking).toHaveBeenCalledWith(body);
    });

    it('GET /redemptions returns redemption history', async () => {
      await request(app.getHttpServer())
        .get(`/engines/promo/redemptions/customer-1/${ORG_ONE}`)
        .set('x-api-key', 'org1-read-key')
        .expect(200);

      expect(promoCodeService.getRedemptionHistory).toHaveBeenCalledWith(
        'customer-1',
        ORG_ONE,
      );
    });
  });

  describe('legacy /promo', () => {
    const post = (path: string, body: Record<string, unknown> = {}) =>
      request(app.getHttpServer())
        .post(path)
        .set('x-api-key', 'org1-key')
        .send(body);

    const get = (path: string) =>
      request(app.getHttpServer()).get(path).set('x-api-key', 'org1-key');

    it('covers promotion CRUD, evaluation and active listing', async () => {
      await post('/promo/create', validPromotionBody).expect(201);
      await post('/promo/evaluate', {
        organizationId: ORG_ONE,
        customerId: 'customer-1',
        transactionAmount: 1000,
        currency: 'INR',
        transactionRef: 'txn-1',
      }).expect(201);
      await post('/promo/active', {
        organizationId: ORG_ONE,
        customerId: 'customer-1',
        cartValue: 1000,
      }).expect(201);
      await get(`/promo/list?organizationId=${ORG_ONE}`).expect(200);
      await get('/promo/promo-1').expect(200);
      await post('/promo/promo-1/update', validPromotionBody).expect(201);
      await post('/promo/promo-1/rules', { rules: [] }).expect(201);

      expect(promoService.createAndPersistPromotion).toHaveBeenCalled();
      expect(promoService.evaluatePromotions).toHaveBeenCalled();
      expect(promoService.getActivePromotions).toHaveBeenCalled();
      expect(promoService.listPromotions).toHaveBeenCalledWith(ORG_ONE);
      expect(promoService.getPromotionById).toHaveBeenCalledWith('promo-1');
      expect(promoService.updatePromotion).toHaveBeenCalled();
      expect(promoService.upsertRules).toHaveBeenCalledWith('promo-1', []);
    });

    it('covers coupon check, lifecycle and lookup', async () => {
      await post('/promo/coupon/check', {
        organizationId: ORG_ONE,
        couponCode: 'SAVE10',
        customerId: 'customer-1',
        cartValue: 1000,
      }).expect(201);
      await post('/promo/coupon/allocate', {
        programId: 'promo-1',
        customerId: 'customer-1',
        couponCode: 'SAVE10',
        discountAmount: 100,
        currency: 'INR',
      }).expect(201);
      await post('/promo/coupon/block', { blockId: 'CPN-1' }).expect(201);
      await post('/promo/coupon/release', {
        blockId: 'CPN-1',
        reason: 'timeout',
      }).expect(201);
      await post('/promo/coupon/claim', {
        blockId: 'CPN-1',
        customerId: 'customer-1',
        couponCode: 'SAVE10',
        transactionRef: 'txn-1',
        claimedAmount: 100,
      }).expect(201);
      await get('/promo/coupon/customer/customer-1').expect(200);
      await get('/promo/coupon/CPN-1').expect(200);

      expect(promoService.checkCouponOnCart).toHaveBeenCalled();
      expect(promoService.allocateCoupon).toHaveBeenCalled();
      expect(promoService.blockCoupon).toHaveBeenCalledWith('CPN-1');
      expect(promoService.releaseCoupon).toHaveBeenCalledWith(
        'CPN-1',
        'timeout',
      );
      expect(promoService.claimCoupon).toHaveBeenCalled();
      expect(promoService.getCustomerCoupons).toHaveBeenCalledWith(
        'customer-1',
      );
      expect(promoService.getCoupon).toHaveBeenCalledWith('CPN-1');
    });

    it('covers claim recording, revocation, lookup and summary', async () => {
      await post('/promo/claim/record', {
        customerId: 'customer-1',
        programId: 'promo-1',
        rewardType: 'COUPON',
        amount: 100,
        currency: 'INR',
        transactionRef: 'txn-1',
      }).expect(201);
      await post('/promo/claim/revoke', {
        claimId: 'claim-1',
        reason: 'refund',
        actor: 'admin',
      }).expect(201);
      await get('/promo/claim/claim-1').expect(200);
      await get('/promo/claim/summary/customer-1').expect(200);

      expect(promoService.recordClaim).toHaveBeenCalled();
      expect(promoService.revokeClaim).toHaveBeenCalledWith(
        'claim-1',
        'refund',
        'admin',
      );
      expect(promoService.getClaimById).toHaveBeenCalledWith('claim-1');
      expect(promoService.getCustomerClaimSummary).toHaveBeenCalledWith(
        'customer-1',
      );
    });

    it('covers coupon code generation, validation and lifecycle', async () => {
      await post('/promo/codes/generate', {
        programId: 'promo-1',
        customerId: 'customer-1',
        isUserSpecific: true,
      }).expect(201);
      await post('/promo/codes/validate', {
        code: 'SAVE10',
        customerId: 'customer-1',
      }).expect(201);
      await post('/promo/codes/allocate', {
        programId: 'promo-1',
        customerId: 'customer-1',
      }).expect(201);
      await post('/promo/codes/claim', {
        code: 'SAVE10',
        customerId: 'customer-1',
        transactionRef: 'txn-1',
      }).expect(201);
      await get('/promo/codes/promo-1').expect(200);
      await get('/promo/codes/promo-1/customer/customer-1').expect(200);

      expect(couponCodeService.generateCodes).toHaveBeenCalled();
      expect(couponCodeService.validateCode).toHaveBeenCalled();
      expect(couponCodeService.allocateCode).toHaveBeenCalledWith(
        'promo-1',
        'customer-1',
      );
      expect(couponCodeService.claimCode).toHaveBeenCalledWith(
        'SAVE10',
        'customer-1',
        'txn-1',
      );
      expect(couponCodeService.listCodes).toHaveBeenCalledWith(
        'promo-1',
        undefined,
      );
      expect(couponCodeService.getCodeByCustomer).toHaveBeenCalledWith(
        'promo-1',
        'customer-1',
      );
    });
  });
});
