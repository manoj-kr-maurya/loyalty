import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CustomerOrganizationOrderController } from 'src/modules/customer-organization-order/customer-organization-order.controller';
import { CustomerOrganizationOrderService } from 'src/modules/customer-organization-order/customer-organization-order.service';
import { ApiKeyService } from 'src/modules/auth/api-key.service';

/**
 * Regression coverage for a subtle NestJS pipe scoping rule: a pipe attached
 * with `@UsePipes()` runs for every handler parameter, not just `@Body()`.
 * A body schema therefore used to be applied to `@CurrentAuth()` and
 * `@Query()` values too, rejecting otherwise valid requests.
 */
describe('Joi pipe parameter binding (e2e)', () => {
  let app: INestApplication;
  const createCustomerOrganizationOrder = jest
    .fn()
    .mockResolvedValue({ id: 'order-1' });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CustomerOrganizationOrderController],
      providers: [
        {
          provide: CustomerOrganizationOrderService,
          useValue: { createCustomerOrganizationOrder },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'ADMIN_API_KEY' ? 'platform-key' : undefined,
          },
        },
        { provide: ApiKeyService, useValue: { validate: async () => null } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    createCustomerOrganizationOrder.mockClear();
  });

  it('accepts a valid body when the handler also declares @CurrentAuth', async () => {
    await request(app.getHttpServer())
      .post('/customer-organization/order')
      .set('x-api-key', 'platform-key')
      .send({
        customerId: 'cust-1',
        organizationId: 'org-1',
        burningAmountDetails: { totalAmount: 100 },
      })
      .expect(201);

    expect(createCustomerOrganizationOrder).toHaveBeenCalledWith(
      'cust-1',
      expect.objectContaining({ organizationId: 'org-1' }),
    );
  });

  it('still rejects an invalid body', async () => {
    await request(app.getHttpServer())
      .post('/customer-organization/order')
      .set('x-api-key', 'platform-key')
      .send({ customerId: 'cust-1', organizationId: 'org-1' })
      .expect(400);

    expect(createCustomerOrganizationOrder).not.toHaveBeenCalled();
  });
});
