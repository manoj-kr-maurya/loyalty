import { Test, TestingModule } from '@nestjs/testing';
import { CommonDBService } from './common-db.service';
import { PrismaService } from 'src/common/services/prismaService';
import { InviteCodeNotFoundException, ShopInvitesNotFoundException } from '../exceptions/common.exception';

describe('CommonDBService', () => {
  let service: CommonDBService;
  let prisma: {
    invite: {
      findFirstOrThrow: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
    interest: {
      create: jest.Mock;
    };
  };

  const mockInvite = {
    id: 'inv-1',
    code: 'INVITE-123',
    email: 'test@example.com',
    role: 'ADMIN',
    status: 'PENDING',
    organizationId: 'org-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockInterest = {
    id: 'int-1',
    phoneNumber: '9876543210',
    name: 'Test User',
    email: 'test@example.com',
    organizationName: 'Test Org',
    createdAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    prisma = {
      invite: {
        findFirstOrThrow: jest.fn().mockResolvedValue(mockInvite),
        create: jest.fn().mockResolvedValue(mockInvite),
        update: jest.fn().mockResolvedValue(mockInvite),
        findMany: jest.fn().mockResolvedValue([mockInvite]),
      },
      interest: {
        create: jest.fn().mockResolvedValue(mockInterest),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommonDBService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CommonDBService>(CommonDBService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findInvite', () => {
    it('should return invite when found', async () => {
      const result = await service.findInvite({ id: 'inv-1' });

      expect(result).toEqual(mockInvite);
      expect(prisma.invite.findFirstOrThrow).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
      });
    });

    it('should throw InviteCodeNotFoundException when invite not found', async () => {
      prisma.invite.findFirstOrThrow.mockRejectedValue(new Error('Record not found'));

      await expect(service.findInvite({ id: 'invalid-id' })).rejects.toThrow(
        InviteCodeNotFoundException,
      );
    });

    it('should accept various where conditions', async () => {
      await service.findInvite({ id: 'inv-2' });
      expect(prisma.invite.findFirstOrThrow).toHaveBeenCalledWith({
        where: { id: 'inv-2' },
      });
    });
  });

  describe('createInvite', () => {
    it('should create and return invite', async () => {
      const form = {
        code: 'NEW-CODE',
        email: 'new@example.com',
        role: 'SHOP',
        status: 'PENDING',
        organization: { connect: { id: 'org-1' } },
      };

      const result = await service.createInvite(form as any);

      expect(result).toEqual(mockInvite);
      expect(prisma.invite.create).toHaveBeenCalledWith({ data: form });
    });

    it('should pass through the data to prisma', async () => {
      const form = { code: 'TEST', email: 'test@test.com' };
      await service.createInvite(form as any);

      expect(prisma.invite.create).toHaveBeenCalledTimes(1);
      expect(prisma.invite.create).toHaveBeenCalledWith({ data: form });
    });
  });

  describe('updateInvite', () => {
    it('should update and return updated invite', async () => {
      const newInvite = { status: 'ACCEPTED' };
      const where = { id: 'inv-1' };

      const result = await service.updateInvite(newInvite as any, where);

      expect(result).toEqual(mockInvite);
      expect(prisma.invite.update).toHaveBeenCalledWith({
        where,
        data: newInvite,
      });
    });

    it('should accept different where conditions', async () => {
      await service.updateInvite({ role: 'ADMIN' } as any, { id: 'inv-1' });

      expect(prisma.invite.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { role: 'ADMIN' },
      });
    });
  });

  describe('findManyInvites', () => {
    it('should return array of invites', async () => {
      const result = await service.findManyInvites({});

      expect(result).toEqual([mockInvite]);
      expect(prisma.invite.findMany).toHaveBeenCalledWith({
        where: {},
      });
    });

    it('should throw ShopInvitesNotFoundException when query fails', async () => {
      prisma.invite.findMany.mockRejectedValue(new Error('DB error'));

      await expect(service.findManyInvites({})).rejects.toThrow(
        ShopInvitesNotFoundException,
      );
    });

    it('should return empty array when no invites found', async () => {
      prisma.invite.findMany.mockResolvedValue([]);

      const result = await service.findManyInvites({});

      expect(result).toEqual([]);
    });
  });

  describe('createInterest', () => {
    it('should create and return interest record', async () => {
      const form = {
        phoneNumber: '9876543210',
        name: 'Test User',
        email: 'test@example.com',
        organizationName: 'Test Org',
      };

      const result = await service.createInterest(form as any);

      expect(result).toEqual(mockInterest);
      expect(prisma.interest.create).toHaveBeenCalledWith({ data: form });
    });

    it('should pass data directly to prisma', async () => {
      const form = { phoneNumber: '1111111111', name: 'Another' };
      await service.createInterest(form as any);

      expect(prisma.interest.create).toHaveBeenCalledWith({ data: form });
    });
  });
});
