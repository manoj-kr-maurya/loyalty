import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { CustomerPrismaHelperService } from './customer-prisma-helper.service';
import { PrismaService } from 'src/common/services/prismaService';
import { CommonException } from 'src/common/exceptions/common.exception';

describe('CustomerPrismaHelperService', () => {
  let helper: CustomerPrismaHelperService;

  const mockPrismaService = {
    customer: {
      findFirstOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    customerOrganizationOrder: {
      findFirst: jest.fn(),
    },
    currency: {
      findMany: jest.fn(),
    },
    customerWallet: {
      findFirst: jest.fn(),
    },
    metaFlagsForCustomer: {
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerPrismaHelperService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    helper = module.get<CustomerPrismaHelperService>(
      CustomerPrismaHelperService,
    );
    jest.clearAllMocks();
  });

  describe('findCustomerWithWalletBalances', () => {
    it('scopes the wallet relation to the requesting organization', async () => {
      mockPrismaService.customer.findFirstOrThrow.mockResolvedValue({
        id: 'cust-1',
        customerWallet: [],
      });

      await helper.findCustomerWithWalletBalances({ id: 'cust-1' }, 'org-a');

      expect(mockPrismaService.customer.findFirstOrThrow).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
        include: {
          customerWallet: {
            where: { organizationId: 'org-a' },
          },
        },
      });
    });
  });

  describe('assertCustomerBelongsToOrganization', () => {
    it('accepts a customer with an order in the organization', async () => {
      mockPrismaService.customerOrganizationOrder.findFirst.mockResolvedValue({
        id: 'order-1',
      });
      mockPrismaService.currency.findMany.mockResolvedValue([]);

      await expect(
        helper.assertCustomerBelongsToOrganization('cust-1', 'org-a'),
      ).resolves.toBeUndefined();
    });

    it('scopes the wallet fallback lookup to the organization', async () => {
      mockPrismaService.customerOrganizationOrder.findFirst.mockResolvedValue(
        null,
      );
      mockPrismaService.currency.findMany.mockResolvedValue([{ code: 'PTS' }]);
      mockPrismaService.customerWallet.findFirst.mockResolvedValue({
        id: 'wallet-1',
      });

      await helper.assertCustomerBelongsToOrganization('cust-1', 'org-a');

      expect(mockPrismaService.customerWallet.findFirst).toHaveBeenCalledWith({
        where: {
          customerId: 'cust-1',
          organizationId: 'org-a',
          currencyCode: { in: ['PTS'] },
        },
        select: { id: true },
      });
    });

    it('rejects a customer whose only wallet belongs to another organization', async () => {
      mockPrismaService.customerOrganizationOrder.findFirst.mockResolvedValue(
        null,
      );
      mockPrismaService.currency.findMany.mockResolvedValue([{ code: 'PTS' }]);
      mockPrismaService.customerWallet.findFirst.mockResolvedValue(null);

      await expect(
        helper.assertCustomerBelongsToOrganization('cust-1', 'org-a'),
      ).rejects.toBeInstanceOf(CommonException);

      await expect(
        helper.assertCustomerBelongsToOrganization('cust-1', 'org-a'),
      ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    });

    it('rejects a missing customer id', async () => {
      await expect(
        helper.assertCustomerBelongsToOrganization(undefined, 'org-a'),
      ).rejects.toBeInstanceOf(CommonException);
    });
  });
});
