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
  };

  const mockCacheService = {
    buildCacheKey: jest.fn((...parts: unknown[]) => parts.join(':')),
    cacheWrapper: jest.fn((_key: string, fn: () => Promise<unknown>) => fn()),
    invalidateCacheByPattern: jest.fn(),
  };

  const mockPrismaService = {
    customer: {
      findUnique: jest.fn(),
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
        { provide: AuthService, useValue: {} },
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
});
