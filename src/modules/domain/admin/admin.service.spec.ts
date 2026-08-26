import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from 'src/common/services/prismaService';

describe('AdminService', () => {
  let service: AdminService;

  const mockPrismaService = {
    organization: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    customer: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    customerWallet: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    customerOrganizationOrder: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    organizationCampaign: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    currency: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    invite: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fetchAllOrganizations', () => {
    it('should return paginated organizations', async () => {
      mockPrismaService.organization.findMany.mockResolvedValue([
        { id: '1', name: 'Test Org', phoneNumber: '1234567890' },
      ]);
      mockPrismaService.organization.count.mockResolvedValue(1);

      const result = await service.fetchAllOrganizations({
        page: 1,
        limit: 10,
        search: '',
      });

      expect(result.organizations).toHaveLength(1);
      expect(result.metadata.totalItems).toBe(1);
      expect(result.metadata.currentPage).toBe(1);
    });

    it('should handle search filter', async () => {
      mockPrismaService.organization.findMany.mockResolvedValue([]);
      mockPrismaService.organization.count.mockResolvedValue(0);

      const result = await service.fetchAllOrganizations({
        page: 1,
        limit: 10,
        search: 'test',
      });

      expect(mockPrismaService.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        }),
      );
    });
  });

  describe('fetchAllCustomers', () => {
    it('should return paginated customers', async () => {
      mockPrismaService.customer.findMany.mockResolvedValue([
        { id: '1', name: 'Test Customer', phoneNumber: '1234567890' },
      ]);
      mockPrismaService.customer.count.mockResolvedValue(1);

      const result = await service.fetchAllCustomers({
        page: 1,
        limit: 10,
        search: '',
      });

      expect(result.customers).toHaveLength(1);
      expect(result.metadata.totalItems).toBe(1);
    });
  });

  describe('fetchOrganizationById', () => {
    it('should return organization by id', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue({
        id: '1',
        name: 'Test Org',
      });

      const result = await service.fetchOrganizationById('1');

      expect(result).toBeDefined();
      expect(result.id).toBe('1');
    });
  });

  describe('fetchCustomerById', () => {
    it('should return customer by id', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue({
        id: '1',
        name: 'Test Customer',
      });

      const result = await service.fetchCustomerById('1');

      expect(result).toBeDefined();
      expect(result.id).toBe('1');
    });
  });
});
