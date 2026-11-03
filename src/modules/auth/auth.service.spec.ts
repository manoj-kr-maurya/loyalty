import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { MailAndSmsService } from '../mail-and-sms/mail-and-sms.service';
import { CommonUtilsService } from 'src/common/utils/common-utils.service';
import { TooManyAttemptsException } from 'src/common/exceptions/common.exception';
import { UserTypes } from 'src/common/enums/user-types';

describe('AuthService', () => {
  let service: AuthService;

  const mockJwtService = {
    sign: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockNotificationService = {
    sendOtpToPhone: jest.fn(),
  };

  const mockCommonUtilsService = {
    generateSessionId: jest.fn(),
    generateOtp: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CACHE_MANAGER, useValue: mockCacheService },
        { provide: MailAndSmsService, useValue: mockNotificationService },
        { provide: CommonUtilsService, useValue: mockCommonUtilsService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateJWT', () => {
    it('should generate a JWT token', async () => {
      mockCommonUtilsService.generateSessionId.mockReturnValue('session-123');
      mockJwtService.sign.mockReturnValue('jwt-token-123');
      mockCacheService.set.mockResolvedValue(undefined);

      const entity = {
        id: 'org-1',
        constructor: { name: 'Organization' },
      } as any;
      const token = await service.generateJWT(entity, UserTypes.organization);

      expect(token).toBe('jwt-token-123');
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'org-1',
          sessionId: 'session-123',
        }),
        expect.any(Object),
      );
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'org-1-session',
        'session-123',
        14 * 24 * 60 * 60 * 1000,
      );
    });
  });

  describe('verifyJWT', () => {
    it('should verify a valid JWT', async () => {
      const payload = { sub: 'org-1', sessionId: 'session-123' };
      mockJwtService.verifyAsync.mockResolvedValue(payload);
      mockCacheService.get.mockResolvedValue('session-123');

      const result = await service.verifyJWT('valid-token');

      expect(result.sub).toBe('org-1');
    });

    it('should throw on invalid session', async () => {
      const payload = { sub: 'org-1', sessionId: 'session-123' };
      mockJwtService.verifyAsync.mockResolvedValue(payload);
      mockCacheService.get.mockResolvedValue('different-session');

      await expect(service.verifyJWT('valid-token')).rejects.toThrow();
    });
  });

  describe('sendLoginOtp', () => {
    it('should send OTP for valid request', async () => {
      mockConfigService.get
        .mockReturnValueOnce('0000000000,0000000001')
        .mockReturnValueOnce('local');

      mockCacheService.get.mockResolvedValue(0);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.sendLoginOtp({
        userType: 'Organization' as any,
        referenceId: 'org-1',
        phoneNumber: '9876543210',
        countryCode: '91',
      });

      expect(result).toBe('123456');
    });

    it('should throw TooManyAttemptsException when rate limit exceeded', async () => {
      mockConfigService.get
        .mockReturnValueOnce('0000000000,0000000001')
        .mockReturnValueOnce('local');

      mockCacheService.get.mockResolvedValue(5);

      await expect(
        service.sendLoginOtp({
          userType: 'Organization' as any,
          referenceId: 'org-1',
          phoneNumber: '9876543210',
          countryCode: '91',
        }),
      ).rejects.toThrow(TooManyAttemptsException);
    });
  });

  describe('validateLoginOtp', () => {
    it('should return true for valid OTP', async () => {
      mockCacheService.get.mockResolvedValue('123456');
      mockCacheService.del.mockResolvedValue(undefined);

      const result = await service.validateLoginOtp({
        referenceId: 'org-1',
        otp: '123456',
      });

      expect(result).toBe(true);
      expect(mockCacheService.del).toHaveBeenCalledWith('org-1');
    });

    it('should return false for invalid OTP', async () => {
      mockCacheService.get.mockResolvedValue('123456');

      const result = await service.validateLoginOtp({
        referenceId: 'org-1',
        otp: '000000',
      });

      expect(result).toBe(false);
    });
  });

  describe('createOtpChallenge / consumeOtpChallenge', () => {
    it('stores the challenge under an opaque id and rate limits per account', async () => {
      mockCommonUtilsService.generateSessionId.mockReturnValue('challenge-1');
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'ENVIRONMENT') return 'local';
        if (key === 'OTP_TIME_OUT_MINUTES') return 10;
        return '0000000000,0000000001';
      });
      mockCacheService.get.mockResolvedValue(0);
      mockCacheService.set.mockResolvedValue(undefined);

      const challengeId = await service.createOtpChallenge({
        userType: UserTypes.organization,
        referenceId: 'org-1',
        phoneNumber: '9876543210',
        countryCode: '91',
      });

      expect(challengeId).toBe('challenge-1');
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'challenge-1',
        '123456',
        10 * 60 * 1000,
      );
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'org-1-otp-limit',
        1,
        15 * 60 * 1000,
      );
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'challenge-1-subject',
        JSON.stringify({
          referenceId: 'org-1',
          userType: UserTypes.organization,
        }),
        10 * 60 * 1000,
      );
    });

    it('returns the subject when the OTP is correct and burns the challenge', async () => {
      mockCacheService.get.mockImplementation((key: string) => {
        if (key === 'challenge-1-subject') {
          return Promise.resolve(
            JSON.stringify({
              referenceId: 'org-1',
              userType: UserTypes.organization,
            }),
          );
        }
        return Promise.resolve('123456');
      });
      mockCacheService.del.mockResolvedValue(undefined);

      const result = await service.consumeOtpChallenge('challenge-1', '123456');

      expect(result).toEqual({
        referenceId: 'org-1',
        userType: UserTypes.organization,
      });
      expect(mockCacheService.del).toHaveBeenCalledWith('challenge-1-subject');
    });

    it('returns null for an unknown challenge', async () => {
      mockCacheService.get.mockResolvedValue(null);

      await expect(
        service.consumeOtpChallenge('unknown', '123456'),
      ).resolves.toBeNull();
    });

    it('returns null for a wrong OTP and keeps the challenge alive', async () => {
      mockCacheService.get.mockImplementation((key: string) => {
        if (key === 'challenge-1-subject') {
          return Promise.resolve(
            JSON.stringify({
              referenceId: 'org-1',
              userType: UserTypes.organization,
            }),
          );
        }
        return Promise.resolve('123456');
      });

      await expect(
        service.consumeOtpChallenge('challenge-1', '000000'),
      ).resolves.toBeNull();
      expect(mockCacheService.del).not.toHaveBeenCalledWith(
        'challenge-1-subject',
      );
    });
  });

  describe('customer session tokens', () => {
    it('signs a tenant scoped, audience bound token', async () => {
      mockJwtService.sign.mockReturnValue('session-token');

      const token = await service.generateCustomerSessionToken(
        'cust-1',
        'org-1',
      );

      expect(token).toBe('session-token');
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'cust-1',
          organizationId: 'org-1',
          aud: 'loyalty',
          sessionType: 'customer_session',
        }),
        expect.objectContaining({ expiresIn: '15m' }),
      );
      // A delegated session is self contained: no server side session.
      expect(mockCacheService.set).not.toHaveBeenCalled();
    });

    it('verifies a valid customer session token', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'cust-1',
        organizationId: 'org-1',
        sessionType: 'customer_session',
      });

      await expect(
        service.verifyCustomerSessionToken('session-token'),
      ).resolves.toEqual({ sub: 'cust-1', organizationId: 'org-1' });
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(
        'session-token',
        expect.objectContaining({ audience: 'loyalty' }),
      );
    });

    it('rejects a token without a tenant', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'cust-1',
        sessionType: 'customer_session',
      });

      await expect(
        service.verifyCustomerSessionToken('session-token'),
      ).rejects.toThrow();
    });

    it('rejects a token that was not minted as a customer session', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'org-1',
        organizationId: 'org-1',
        sessionType: 'something_else',
      });

      await expect(
        service.verifyCustomerSessionToken('session-token'),
      ).rejects.toThrow();
    });
  });
});
