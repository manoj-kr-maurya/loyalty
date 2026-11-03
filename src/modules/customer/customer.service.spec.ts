import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CustomerPrismaHelperService } from './customer-prisma-helper.service';
import { AuthService } from '../auth/auth.service';
import { CacheService } from 'src/common/services/cache/cache.service';
import { ImgBBService } from 'src/modules/imgbb/imgbb.service';
import { PrismaService } from 'src/common/services/prismaService';
import { CommonException } from 'src/common/exceptions/common.exception';

describe('CustomerService', () => {
  let service: CustomerService;

  const mockPrismaHelperService = {
    assertCustomerBelongsToOrganization: jest.fn(),
    findCustomerWithWalletBalances: jest.fn(),
    findCustomerWithoutNestedData: jest.fn(),
    findCustomer: jest.fn(),
    updateCustomer: jest.fn(),
    findCustomerForOrganization: jest.fn(),
    findCustomerByExternalId: jest.fn(),
    createCustomerForOrganization: jest.fn(),
  };

  const mockCacheService = {
    buildCacheKey: jest.fn((...parts: unknown[]) => parts.join(':')),
    cacheWrapper: jest.fn((_key: string, fn: () => Promise<unknown>) => fn()),
    invalidateCacheByPattern: jest.fn(),
  };

  const mockAuthService = {
    generateCustomerSessionToken: jest.fn(),
  };

  const mockPrismaService = {
    customer: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    customerWallet: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    customerOrganizationOrder: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    loyaltyLedgerEntry: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerService,
        {
          provide: CustomerPrismaHelperService,
          useValue: mockPrismaHelperService,
        },
        { provide: AuthService, useValue: mockAuthService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: ImgBBService, useValue: {} },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CustomerService>(CustomerService);
    jest.clearAllMocks();
  });

  describe('getCustomerForOrganization', () => {
    it('loads wallet balances scoped to the requesting organization', async () => {
      mockPrismaHelperService.findCustomerWithWalletBalances.mockResolvedValue({
        id: 'cust-1',
        name: 'John',
        customerWallet: [
          { id: 'wallet-a', organizationId: 'org-a', currencyCode: 'PTS' },
        ],
      });

      const result: any = await service.getCustomerForOrganization(
        'cust-1',
        'org-a',
        true,
      );

      expect(
        mockPrismaHelperService.findCustomerWithWalletBalances,
      ).toHaveBeenCalledWith({ id: 'cust-1' }, 'org-a');
      expect(result.customerWallets).toHaveLength(1);
      expect(result.customerWallets[0].organizationId).toBe('org-a');
      expect(result.customer.customerWallet).toBeUndefined();
    });

    it('does not load wallet balances when balances are not requested', async () => {
      mockPrismaHelperService.findCustomerWithoutNestedData.mockResolvedValue({
        id: 'cust-1',
        name: 'John',
      });

      const result: any = await service.getCustomerForOrganization(
        'cust-1',
        'org-a',
        false,
      );

      expect(
        mockPrismaHelperService.findCustomerWithWalletBalances,
      ).not.toHaveBeenCalled();
      expect(result.id).toBe('cust-1');
    });

    it('rejects a customer that does not belong to the organization', async () => {
      mockPrismaHelperService.assertCustomerBelongsToOrganization.mockRejectedValue(
        new CommonException(
          'Customer not found in organization',
          HttpStatus.NOT_FOUND,
        ),
      );

      await expect(
        service.getCustomerForOrganization('cust-1', 'org-a', true),
      ).rejects.toBeInstanceOf(CommonException);
      expect(
        mockPrismaHelperService.findCustomerWithWalletBalances,
      ).not.toHaveBeenCalled();
    });
  });

  describe('tenant scoped reads', () => {
    it('scopes the profile lookup to the session organization', async () => {
      mockPrismaService.customer.findFirst.mockResolvedValue({
        id: 'cust-1',
        name: 'John',
      });

      await service.getMyProfile('cust-1', 'org-a');

      expect(mockPrismaService.customer.findFirst).toHaveBeenCalledWith({
        where: { id: 'cust-1', organizationId: 'org-a' },
        include: { metaFlags: true },
      });
    });

    it('scopes the wallet lookup to the session organization', async () => {
      mockPrismaService.customerWallet.findMany.mockResolvedValue([]);

      await service.getMyWallets('cust-1', 'org-a');

      expect(mockPrismaService.customerWallet.findMany).toHaveBeenCalledWith({
        where: { customerId: 'cust-1', organizationId: 'org-a' },
        orderBy: [{ currencyCode: 'asc' }],
      });
    });

    it('scopes the order lookup to the session organization', async () => {
      mockPrismaService.customerOrganizationOrder.findMany.mockResolvedValue(
        [],
      );
      mockPrismaService.customerOrganizationOrder.count.mockResolvedValue(0);

      await service.getMyOrders('cust-1', 'org-a', 1, 20);

      expect(
        mockPrismaService.customerOrganizationOrder.count,
      ).toHaveBeenCalledWith({
        where: { customerId: 'cust-1', organizationId: 'org-a' },
      });
    });
  });

  describe('createCustomerSession', () => {
    it('resolves an existing customer by the tenant external id', async () => {
      mockPrismaHelperService.findCustomerByExternalId.mockResolvedValue({
        id: 'cust-1',
        name: 'John',
        token: 'stale-token',
      });
      mockAuthService.generateCustomerSessionToken.mockResolvedValue(
        'session-token',
      );

      const result = await service.createCustomerSession('org-a', {
        externalId: 'ext-1',
      });

      expect(
        mockPrismaHelperService.findCustomerByExternalId,
      ).toHaveBeenCalledWith('org-a', 'ext-1');
      expect(mockAuthService.generateCustomerSessionToken).toHaveBeenCalledWith(
        'cust-1',
        'org-a',
      );
      expect(result.token).toBe('session-token');
      expect(result.customer.token).toBe('');
    });

    it('creates a tenant scoped customer when the shopper is unknown', async () => {
      mockPrismaHelperService.findCustomerForOrganization.mockRejectedValue(
        new Error('not found'),
      );
      mockPrismaHelperService.createCustomerForOrganization.mockResolvedValue({
        id: 'cust-new',
      });
      mockAuthService.generateCustomerSessionToken.mockResolvedValue(
        'session-token',
      );

      const result = await service.createCustomerSession('org-a', {
        phoneNumber: '9898989898',
        name: 'John',
      });

      expect(
        mockPrismaHelperService.createCustomerForOrganization,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-a',
          phoneNumber: '9898989898',
        }),
      );
      expect(result.customer.id).toBe('cust-new');
    });

    it('refuses to create a customer without a phone number', async () => {
      mockPrismaHelperService.findCustomerByExternalId.mockRejectedValue(
        new Error('not found'),
      );

      await expect(
        service.createCustomerSession('org-a', { externalId: 'ext-1' }),
      ).rejects.toBeInstanceOf(CommonException);
      expect(
        mockPrismaHelperService.createCustomerForOrganization,
      ).not.toHaveBeenCalled();
    });
  });
});
