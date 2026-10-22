import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { MailAndSmsService } from '../mail-and-sms/mail-and-sms.service';
import { CommonUtilsService } from 'src/common/utils/common-utils.service';
import { TooManyAttemptsException } from 'src/common/exceptions/common.exception';

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

      const entity = { id: 'org-1', constructor: { name: 'Organization' } } as any;
      const token = await service.generateJWT(entity);

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
});
