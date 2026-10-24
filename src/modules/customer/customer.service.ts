import { Injectable, Logger } from '@nestjs/common';
import { ImgBBService } from 'src/modules/imgbb/imgbb.service';
import { Customer } from '@prisma/client';
import { UserTypes } from 'src/common/enums/user-types';
import { AuthService } from '../auth/auth.service';
import {
  OtpPhoneFindOrCreateCustomerForm,
  OtpValidateOtpBodyForm,
  UpdateCustomerForm,
} from './DTO/customer.dto';
import { WrongCustomerOtpException } from './exceptions/customer.exception';
import { CustomerPrismaHelperService } from './customer-prisma-helper.service';
import { CacheService } from 'src/common/services/cache/cache.service';
import {
  Cacheable,
  InvalidateCache,
} from 'src/common/decorators/cache.decorator';

@Injectable()
export class CustomerService {
  private logger = new Logger('Customer Service');

  // Cache keys and prefixes
  private readonly CACHE_PREFIX = 'customer';
  private readonly LEADERBOARD_CACHE_PREFIX = `${this.CACHE_PREFIX}:leaderboard`;

  constructor(
    private readonly authService: AuthService,
    private readonly customerPrismaHelperService: CustomerPrismaHelperService,
    private readonly cacheService: CacheService,
    private readonly imgbbService: ImgBBService,
  ) {}

  async findOrCreateCustomersAndProceedPhoneAuthentication(
    form: OtpPhoneFindOrCreateCustomerForm,
  ) {
    const customer =
      await this.customerPrismaHelperService.findOrCreateCustomerByPhoneNumber(
        form,
      );

    await this.authService.sendLoginOtp({
      userType: UserTypes.customer,
      referenceId: customer.id,
      phoneNumber: customer.phoneNumber,
      countryCode: customer.countryCode,
    });
    return customer.id;
  }

  async validateOtpAndGenerateToken(
    form: OtpValidateOtpBodyForm,
  ): Promise<{ token: string; customer: Customer }> {
    const isItTheCorrectOtp = await this.authService.validateLoginOtp({
      referenceId: form.id,
      otp: form.otp,
    });
    if (!isItTheCorrectOtp) {
      throw new WrongCustomerOtpException();
    }
    const customer = await this.customerPrismaHelperService.findCustomer({
      id: form.id,
    });
    const token = await this.authService.generateJWT(
      customer,
      UserTypes.customer,
    );
    customer.token = token;
    const updatedCustomer =
      await this.customerPrismaHelperService.updateCustomer(
        {
          ...customer,
          isVerified: true,
          token: customer.token,
          metaFlags: { update: { initJourneyCompleted: true } },
        },
        {
          id: customer.id,
        },
      );

    return { token, customer: updatedCustomer };
  }

  @Cacheable({
    ttl: 300, // 5 minutes cache for customer profiles
    serviceName: 'CustomerService',
    methodName: 'getCustomerById',
    cacheKeyParams: (args) => ({ id: args[0] }),
  })
  async getCustomerById(id: string): Promise<Customer | null> {
    this.logger.debug(`Cache miss for customer ID: ${id}`);
    return await this.customerPrismaHelperService.findCustomerWithoutNestedData(
      {
        id,
      },
    );
  }

  async someFunctionThatMyGetCustomerEndPointWillCall(
    id: string,
    balances: boolean,
  ): Promise<{ customer: Customer; customerWallets: any } | Customer> {
    if (balances) {
      const { customerWallet: customerWallets, ...customer } =
        await this.customerPrismaHelperService.findCustomerWithWalletBalances({
          id,
        });
      return { customer, customerWallets };
    }
    return await this.getCustomerById(id);
  }

  async someFunctionThatMyUpdateCustomerEndPointWillCall(
    customerId: string,
    form: UpdateCustomerForm,
  ) {
    const { base64Logo, name } = form;
    const customer = await this.getCustomerById(customerId);
    let logoUrl = customer.logoUrl;

    if (base64Logo) {
      logoUrl = await this.imgbbService.uploadImage(base64Logo, 'logo');
    }

    // Whitelist mutable fields. The Joi schema allows unknown keys, so
    // spreading the raw form here would let a caller overwrite `token`,
    // `phoneNumber`, or `isVerified`.
    const newCustomer = await this.updateCustomer({
      ...customer,
      ...(name !== undefined && { name }),
      ...(base64Logo && { logoUrl }),
    });
    return newCustomer;
  }

  async getCustomerForOrganization(
    customerId: string,
    organizationId: string,
    balances: boolean,
  ) {
    await this.customerPrismaHelperService.assertCustomerBelongsToOrganization(
      customerId,
      organizationId,
    );
    return this.someFunctionThatMyGetCustomerEndPointWillCall(
      customerId,
      balances,
    );
  }

  async getCustomerByIdForOrganization(
    customerId: string,
    organizationId: string,
  ) {
    await this.customerPrismaHelperService.assertCustomerBelongsToOrganization(
      customerId,
      organizationId,
    );
    return this.getCustomerById(customerId);
  }

  async updateCustomerForOrganization(
    customerId: string,
    organizationId: string,
    form: UpdateCustomerForm,
  ) {
    await this.customerPrismaHelperService.assertCustomerBelongsToOrganization(
      customerId,
      organizationId,
    );
    return this.someFunctionThatMyUpdateCustomerEndPointWillCall(
      customerId,
      form,
    );
  }

  async logoutCustomerForOrganization(
    customerId: string,
    organizationId: string,
  ) {
    await this.customerPrismaHelperService.assertCustomerBelongsToOrganization(
      customerId,
      organizationId,
    );
    return this.logoutCustomer(customerId);
  }

  @InvalidateCache([
    'customer:*', // Invalidate all customer-related caches
  ])
  async updateCustomer(newWholeCustomer: Customer): Promise<Customer> {
    const { id, ...restOfTheCustomer } = newWholeCustomer;
    const customer = await this.customerPrismaHelperService.updateCustomer(
      restOfTheCustomer,
      { id },
    );

    return customer;
  }

  async logoutCustomer(cusId: string) {
    try {
      // Find the organization by ID
      const cus = await this.customerPrismaHelperService.findCustomer({
        id: cusId,
      });

      // Update the organization document in the database
      await this.updateCustomer({ ...cus, token: '' });

      return { success: true, message: 'Token removed successfully' };
    } catch (error) {
      // Handle errors
      console.error('Error logging out customer:', error);
      return { success: false, message: 'Failed to logout customer' };
    }
  }

  async updateFcmToken(fcmToken: string, cusId: string) {
    const customer = await this.getCustomerById(cusId);
    return this.updateCustomer({ ...customer, fcmToken });
  }

  /**
   * Get top customers for leaderboard with caching
   * @param interval - Time interval in hours (default: 48)
   * @returns Leaderboard data
   */
  @Cacheable({
    ttl: 60, // 1 minute TTL as specified
    serviceName: 'CustomerService',
    methodName: 'getTopCustomersForLeaderBoard',
    cacheKeyParams: (args) => ({ interval: args[0] || 48, organizationId: args[1] }),
  })
  async getTopCustomersForLeaderBoard(
    interval = 48,
    organizationId?: string,
  ) {
    this.logger.debug(
      `Cache miss for leaderboard with interval: ${interval}h org=${organizationId}`,
    );
    return await this.customerPrismaHelperService.getTopCustomersForLeaderBoard(
      interval,
      organizationId,
    );
  }

  /**
   * Manually invalidate leaderboard cache
   */
  async invalidateLeaderboardCache(): Promise<void> {
    await this.cacheService.invalidateCacheByPattern(
      `${this.LEADERBOARD_CACHE_PREFIX}:*`,
    );
    this.logger.debug('Manually invalidated leaderboard cache');
  }
}
