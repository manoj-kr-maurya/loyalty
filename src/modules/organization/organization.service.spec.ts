import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationService } from './organization.service';
import { OrganizationPrismaHelperService } from './organization-prisma-helper.service';
import { AuthService } from '../auth/auth.service';
import { CommonDBService } from 'src/common/services/common-db.service';
import { ImgBBService } from 'src/modules/imgbb/imgbb.service';
import { PrismaService } from 'src/common/services/prismaService';
import { CommonException } from 'src/common/exceptions/common.exception';
import { WrongOrganizationOtpException } from './exceptions/organization.exception';
import { hashPassword } from 'src/common/utils/password.util';

describe('OrganizationService auth', () => {
  let service: OrganizationService;

  const mockOrganization = {
    id: 'org-1',
    name: 'Retail Co',
    phoneNumber: '9898989898',
    countryCode: '91',
    username: null as string | null,
    passwordHash: null as string | null,
  };

  const mockPrismaHelperService = {
    findOrganization: jest.fn(),
    findOrganizationByUsername: jest.fn(),
    updateOrganization: jest.fn(),
    findMetaFlagsForOrganization: jest.fn(),
  };

  const mockAuthService = {
    createOtpChallenge: jest.fn(),
    consumeOtpChallenge: jest.fn(),
    generateJWT: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        {
          provide: OrganizationPrismaHelperService,
          useValue: mockPrismaHelperService,
        },
        { provide: AuthService, useValue: mockAuthService },
        { provide: CommonDBService, useValue: {} },
        { provide: ImgBBService, useValue: {} },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
    jest.clearAllMocks();
  });

  describe('setCredentials', () => {
    it('stores a hashed password and the username', async () => {
      mockPrismaHelperService.findOrganization.mockResolvedValue({
        ...mockOrganization,
      });
      mockPrismaHelperService.findOrganizationByUsername.mockResolvedValue(
        null,
      );
      mockPrismaHelperService.updateOrganization.mockImplementation(
        (data: any) => ({ ...mockOrganization, ...data }),
      );

      const result = await service.setCredentials('org-1', {
        username: 'jas.retail',
        password: 'a-strong-password',
      });

      expect(result.username).toBe('jas.retail');
      expect(result.passwordHash).not.toBe('a-strong-password');
      expect(result.passwordHash.startsWith('scrypt$')).toBe(true);
    });

    it('refuses to overwrite existing credentials', async () => {
      mockPrismaHelperService.findOrganization.mockResolvedValue({
        ...mockOrganization,
        passwordHash: 'scrypt$1$2$3$4$5',
      });

      await expect(
        service.setCredentials('org-1', {
          username: 'jas.retail',
          password: 'a-strong-password',
        }),
      ).rejects.toBeInstanceOf(CommonException);
      expect(mockPrismaHelperService.updateOrganization).not.toHaveBeenCalled();
    });

    it('refuses a username that is already taken', async () => {
      mockPrismaHelperService.findOrganization.mockResolvedValue({
        ...mockOrganization,
      });
      mockPrismaHelperService.findOrganizationByUsername.mockResolvedValue({
        id: 'org-2',
      });

      await expect(
        service.setCredentials('org-1', {
          username: 'jas.retail',
          password: 'a-strong-password',
        }),
      ).rejects.toBeInstanceOf(CommonException);
      expect(mockPrismaHelperService.updateOrganization).not.toHaveBeenCalled();
    });
  });

  describe('loginWithCredentials', () => {
    it('sends the OTP to the mobile number on file and returns a challenge', async () => {
      mockPrismaHelperService.findOrganizationByUsername.mockResolvedValue({
        ...mockOrganization,
        passwordHash: await hashPassword('a-strong-password'),
      });
      mockAuthService.createOtpChallenge.mockResolvedValue('challenge-1');

      const result = await service.loginWithCredentials({
        username: 'jas.retail',
        password: 'a-strong-password',
      });

      expect(result).toEqual({ challengeId: 'challenge-1' });
      expect(mockAuthService.createOtpChallenge).toHaveBeenCalledWith({
        userType: 'organization',
        referenceId: 'org-1',
        phoneNumber: '9898989898',
        countryCode: '91',
      });
    });

    it('rejects a wrong password without sending an OTP', async () => {
      mockPrismaHelperService.findOrganizationByUsername.mockResolvedValue({
        ...mockOrganization,
        passwordHash: await hashPassword('a-strong-password'),
      });

      await expect(
        service.loginWithCredentials({
          username: 'jas.retail',
          password: 'wrong-password',
        }),
      ).rejects.toBeInstanceOf(CommonException);
      expect(mockAuthService.createOtpChallenge).not.toHaveBeenCalled();
    });

    it('rejects an unknown username', async () => {
      mockPrismaHelperService.findOrganizationByUsername.mockResolvedValue(
        null,
      );

      await expect(
        service.loginWithCredentials({
          username: 'nobody',
          password: 'a-strong-password',
        }),
      ).rejects.toBeInstanceOf(CommonException);
      expect(mockAuthService.createOtpChallenge).not.toHaveBeenCalled();
    });
  });

  describe('verifyLoginChallenge', () => {
    it('returns a token when the OTP is correct', async () => {
      mockAuthService.consumeOtpChallenge.mockResolvedValue({
        referenceId: 'org-1',
        userType: 'organization',
      });
      mockPrismaHelperService.findOrganization.mockResolvedValue({
        ...mockOrganization,
      });
      mockAuthService.generateJWT.mockResolvedValue('jwt-token');

      const result = await service.verifyLoginChallenge({
        challengeId: 'challenge-1',
        otp: '123456',
      });

      expect(result.token).toBe('jwt-token');
      expect(result.organization.id).toBe('org-1');
    });

    it('rejects a wrong OTP', async () => {
      mockAuthService.consumeOtpChallenge.mockResolvedValue(null);

      await expect(
        service.verifyLoginChallenge({
          challengeId: 'challenge-1',
          otp: '000000',
        }),
      ).rejects.toBeInstanceOf(WrongOrganizationOtpException);
      expect(mockAuthService.generateJWT).not.toHaveBeenCalled();
    });
  });
});
