import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Customer, Organization } from '@prisma/client';
import { UserTypes } from 'src/common/enums/user-types';
import {
  InvalidJWTException,
  InvalidSessionException,
  TooManyAttemptsException,
} from 'src/common/exceptions/common.exception';
import { Environments, envEnums } from 'src/config/enums';
import { Cache } from 'cache-manager';
import { MailAndSmsService } from '../mail-and-sms/mail-and-sms.service';
import { CommonUtilsService } from 'src/common/utils/common-utils.service';

// No public/private JWT differentiation
@Injectable()
export class AuthService {
  private logger = new Logger('AuthService');

  constructor(
    private readonly jwtService: JwtService,
    private readonly commonUtilsService: CommonUtilsService,
    private readonly configService: ConfigService,
    private readonly notificationService: MailAndSmsService,
    @Inject(CACHE_MANAGER) private cacheService: Cache,
  ) {}

  // Generate JWT with token expiry validation. The caller must supply the
  // identity type explicitly: Prisma returns plain objects, so relying on
  // `entity.constructor.name` yields "Object" for both customers and
  // organizations and breaks every downstream authorization check.
  async generateJWT(
    entity: Organization | Customer,
    userType: UserTypes,
  ): Promise<string> {
    const sessionId = this.commonUtilsService.generateSessionId();
    const payload: Record<string, any> = {
      sub: entity.id,
      sessionId,
      userType,
    };
    const token = this.jwtService.sign(payload, {
      secret: this.configService.get(envEnums.JWT_SECRET),
      expiresIn: '14d', // Set token expiry to 14 days
    });

    // Cache the session ID for single-device login (TTL: 14 days)
    await this.cacheService.set(
      `${entity.id}-session`,
      sessionId,
      14 * 24 * 60 * 60 * 1000, // 14 days in milliseconds
    );

    return token;
  }

  // Verify JWT with token expiry and session check
  async verifyJWT(token: string, userType?: UserTypes): Promise<any> {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get(envEnums.JWT_SECRET),
      });

      const cachedSessionId = await this.cacheService.get(
        `${payload.sub}-session`,
      );

      if (cachedSessionId !== payload.sessionId) {
        throw new InvalidSessionException();
      }

      if (userType && payload.userType !== userType) {
        throw new InvalidJWTException();
      }

      return payload;
    } catch (error) {
      this.logger.error('JWT verification failed', error);
      throw new InvalidJWTException();
    }
  }

  // Generate and save OTP with rate-limiting and environment-based OTP
  private async generateAndSaveOtp(
    referenceId: string,
    phoneNumber: string,
  ): Promise<{ value: string; isReal: boolean }> {
    let otp: { value: string; isReal: boolean };
    if (
      this.configService
        .get(envEnums.COMMA_SEPARATED_TESTING_PHONE_NUMBERS)
        .split(',')
        .includes(phoneNumber) ||
      this.configService.get(envEnums.ENVIRONMENT) === Environments.local ||
      this.configService.get(envEnums.ENVIRONMENT) === Environments.dev ||
      this.configService.get(envEnums.ENVIRONMENT) === Environments.stage
    ) {
      otp = { value: '123456', isReal: false }; // Hardcoded OTP for testing purposes
    } else {
      otp = { value: this.commonUtilsService.generateOtp(6), isReal: true }; // Generate 6-digit OTP for production
    }

    const ttlInMilliSeconds =
      60 * this.configService.get(envEnums.OTP_TIME_OUT_MINUTES) * 1000;

    // Implement OTP rate-limiting: max 5 OTPs in a 15-minute window
    const otpLimitKey = `${referenceId}-otp-limit`;
    const otpRequests = (await this.cacheService.get<number>(otpLimitKey)) || 0;
    if (otpRequests >= 5) {
      throw new TooManyAttemptsException();
    }

    // Increment OTP request count and set TTL (15 minutes)
    await this.cacheService.set(otpLimitKey, otpRequests + 1, 15 * 60 * 1000);

    // Save the OTP in cache with TTL
    await this.cacheService.set(referenceId, otp.value, ttlInMilliSeconds);

    return otp;
  }

  // Send login OTP (with rate-limiting in place)
  async sendLoginOtp({
    userType,
    referenceId,
    phoneNumber,
    countryCode,
  }: {
    userType: UserTypes;
    referenceId: string;
    phoneNumber: string;
    countryCode: string;
  }) {
    const otp = await this.generateAndSaveOtp(referenceId, phoneNumber);
    if (!otp.isReal) {
      // Skip sending OTP for prod testing
      return otp.value;
    }
    await this.notificationService.sendOtpToPhone(
      userType,
      countryCode,
      phoneNumber,
      otp.value,
    );

    return otp.value;
  }

  // Validate OTP for login and clear OTP from cache
  async validateLoginOtp({
    referenceId,
    otp,
  }: {
    referenceId: string;
    otp: string;
  }): Promise<boolean> {
    const latestOtpForThisReferenceId = await this.cacheService.get(
      referenceId,
    );
    
    // Check if the provided OTP matches the cached OTP
    if (latestOtpForThisReferenceId === otp) {
      // OTP is valid, clear it from the cache
      await this.cacheService.del(referenceId);
      return true;
    }

    return false;
  }
}
