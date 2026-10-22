import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';
import { ConfigService } from '@nestjs/config';

describe('AdminController', () => {
  let controller: AdminController;
  let service: AdminService;

  const mockAdminService = {
    fetchAllOrganizations: jest.fn(),
    fetchAllCustomers: jest.fn(),
    fetchOrganizationById: jest.fn(),
    fetchCustomerById: jest.fn(),
    fetchCustomerWallets: jest.fn(),
    fetchCustomerOrders: jest.fn(),
    fetchOrganizationCampaigns: jest.fn(),
    fetchOrganizationCurrencies: jest.fn(),
    fetchOrganizationCustomerOrders: jest.fn(),
    inviteAdmin: jest.fn(),
  };

  const mockApiKeyGuard = { canActivate: jest.fn().mockReturnValue(true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: mockAdminService },
        { provide: ApiKeyGuard, useValue: mockApiKeyGuard },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue(mockApiKeyGuard)
      .compile();

    controller = module.get<AdminController>(AdminController);
    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('fetchAllOrganizations', () => {
    it('should return paginated organizations', async () => {
      const mockResult = {
        organizations: [{ id: '1', name: 'Test Org' }],
        metadata: { currentPage: 1, totalPages: 1, totalItems: 1, itemsPerPage: 10 },
      };
      mockAdminService.fetchAllOrganizations.mockResolvedValue(mockResult);

      const result = await controller.fetchAllOrganizations({ page: 1, limit: 10, search: '' });

      expect(result.status).toBe('Success');
      expect(result.data).toEqual(mockResult.organizations);
      expect(result.metadata).toEqual(mockResult.metadata);
    });
  });

  describe('fetchAllCustomers', () => {
    it('should return paginated customers', async () => {
      const mockResult = {
        customers: [{ id: '1', name: 'Test Customer' }],
        metadata: { currentPage: 1, totalPages: 1, totalItems: 1, itemsPerPage: 10 },
      };
      mockAdminService.fetchAllCustomers.mockResolvedValue(mockResult);

      const result = await controller.fetchAllCustomers({ page: 1, limit: 10, search: '' });

      expect(result.status).toBe('Success');
      expect(result.data).toEqual(mockResult.customers);
    });
  });

  describe('fetchOrganizationById', () => {
    it('should return organization by id', async () => {
      const mockOrg = { id: '1', name: 'Test Org' };
      mockAdminService.fetchOrganizationById.mockResolvedValue(mockOrg);

      const result = await controller.fetchOrganizationById('1');

      expect(result.status).toBe('Success');
      expect(result.data).toEqual(mockOrg);
    });
  });

  describe('fetchCustomerById', () => {
    it('should return customer by id', async () => {
      const mockCustomer = { id: '1', name: 'Test Customer' };
      mockAdminService.fetchCustomerById.mockResolvedValue(mockCustomer);

      const result = await controller.fetchCustomerById('1');

      expect(result.status).toBe('Success');
      expect(result.data).toEqual(mockCustomer);
    });
  });

  describe('inviteShop', () => {
    it('should invite admin successfully', async () => {
      const mockInvite = { id: '1', email: 'admin@test.com' };
      mockAdminService.inviteAdmin.mockResolvedValue(mockInvite);

      const result = await controller.inviteShop({ email: 'admin@test.com', name: 'Test Admin' } as any);

      expect(result.status).toBe('Success');
      expect(result.data).toEqual(mockInvite);
    });
  });
});
