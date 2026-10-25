import { INestApplication, Module } from '@nestjs/common';
import { APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from 'src/common/services/prismaService';
import { TenantScopeInterceptor } from 'src/interceptors/tenant/tenant-scope.interceptor';
import { ApiKeyService } from 'src/modules/auth/api-key.service';
import { PLBEngineController } from 'src/engines/plb-engine/plb-engine.controller';
import { PLBEngineService } from 'src/engines/plb-engine/plb-engine.service';
import { ValueExchangeEngineController } from 'src/engines/value-exchange-engine/value-exchange-engine.controller';
import { ValueExchangeEngineService } from 'src/engines/value-exchange-engine/value-exchange-engine.service';

@Module({
  controllers: [PLBEngineController, ValueExchangeEngineController],
  providers: [
    PLBEngineService,
    ValueExchangeEngineService,
    { provide: PrismaService, useValue: {} },
    {
      provide: ConfigService,
      useValue: { get: () => 'platform-key' },
    },
    {
      provide: ApiKeyService,
      useValue: {
        validate: async (key: string) => {
          if (key === 'org1-key') {
            return {
              type: 'organization',
              organizationId: 'org-1',
              scopes: [
                'plb:write',
                'plb:read',
                'exchange:write',
                'exchange:read',
              ],
            };
          }
          if (key === 'org2-key') {
            return {
              type: 'organization',
              organizationId: 'org-2',
              scopes: [
                'plb:write',
                'plb:read',
                'exchange:write',
                'exchange:read',
              ],
            };
          }
          return null;
        },
      },
    },
    Reflector,
    { provide: APP_INTERCEPTOR, useClass: TenantScopeInterceptor },
  ],
})
class TenantIsolationTestModule {}

describe('Tenant isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: {
    pLBProgram: { findFirst: jest.Mock };
    pLBMetric: { upsert: jest.Mock };
    exchangeAgreement: { findFirst: jest.Mock };
  };

  const program = {
    id: 'program-1',
    organizationId: 'org-1',
    name: 'Org 1 program',
    metricDefinitions: { metricKey: 'revenue' },
    slabDefinitions: [],
    cycleStart: new Date('2026-01-01'),
    cycleEnd: new Date('2026-12-31'),
  };

  beforeAll(async () => {
    prisma = {
      pLBProgram: { findFirst: jest.fn() },
      pLBMetric: { upsert: jest.fn() },
      exchangeAgreement: { findFirst: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      imports: [TenantIsolationTestModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.pLBProgram.findFirst.mockImplementation(({ where }) =>
      Promise.resolve(
        where.id === program.id &&
          where.organizationId === program.organizationId
          ? program
          : null,
      ),
    );
    prisma.pLBMetric.upsert.mockResolvedValue({
      id: 'metric-1',
      metricValue: 10,
    });
  });

  it('rejects a body organization that does not match the API key', async () => {
    await request(app.getHttpServer())
      .post('/engines/plb/metrics')
      .set('x-api-key', 'org2-key')
      .send({
        organizationId: 'org-1',
        programId: 'program-1',
        customerId: 'customer-1',
        metricValue: 10,
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
      })
      .expect(403);
  });

  it('does not let org B write a metric into org A program', async () => {
    await request(app.getHttpServer())
      .post('/engines/plb/metrics')
      .set('x-api-key', 'org2-key')
      .send({
        organizationId: 'org-2',
        programId: 'program-1',
        customerId: 'customer-1',
        metricValue: 10,
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
      })
      .expect(404);

    expect(prisma.pLBMetric.upsert).not.toHaveBeenCalled();
  });

  it('allows the owning organization to write the metric', async () => {
    await request(app.getHttpServer())
      .post('/engines/plb/metrics')
      .set('x-api-key', 'org1-key')
      .send({
        organizationId: 'org-1',
        programId: 'program-1',
        customerId: 'customer-1',
        metricValue: 10,
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
      })
      .expect(201);

    expect(prisma.pLBMetric.upsert).toHaveBeenCalledTimes(1);
  });

  it('does not quote another source entity agreement', async () => {
    prisma.exchangeAgreement.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer())
      .post('/engines/value-exchange/quote')
      .set('x-api-key', 'org2-key')
      .send({
        agreementId: 'agreement-1',
        sourceEntityId: 'org-2',
        sourceCustomerId: 'customer-1',
        sourceAmount: 100,
      })
      .expect(404);
  });
});
