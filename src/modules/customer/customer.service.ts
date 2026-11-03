import { Injectable, Logger } from '@nestjs/common';
import { ImgBBService } from 'src/modules/imgbb/imgbb.service';
import { Customer } from '@prisma/client';
import { PrismaService } from 'src/common/services/prismaService';
import { UserTypes } from 'src/common/enums/user-types';
import { AuthService } from '../auth/auth.service';
import {
  OtpPhoneFindOrCreateCustomerForm,
  OtpValidateOtpBodyForm,
  UpdateCustomerForm,
} from './DTO/customer.dto';
import { WrongCustomerOtpException } from './exceptions/customer.exception';
import { CustomerPrismaHelperService } from './customer-prisma-helper.service';
import { CommonException } from 'src/common/exceptions/common.exception';
import { StatusCodes } from 'src/common/enums/status-codes';
import { CacheService } from 'src/common/services/cache/cache.service';
import {
  Cacheable,
  InvalidateCache,
} from 'src/common/decorators/cache.decorator';
import { CUSTOMER_SESSION_TOKEN_TTL } from '../auth/auth.service';
import to from 'await-to-js';

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
    private readonly prisma: PrismaService,
  ) {}

  async getMyProfile(customerId: string, organizationId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId },
      include: { metaFlags: true },
    });

    if (!customer) {
      throw new CommonException('Customer not found', StatusCodes.NOT_FOUND);
    }

    return customer;
  }

  async updateMyProfile(
    customerId: string,
    organizationId: string,
    form: { name?: string },
  ) {
    return this.prisma.customer.update({
      where: { id: customerId, organizationId },
      data: {
        ...(form.name !== undefined && { name: form.name }),
      },
    });
  }

  async getMyWallets(customerId: string, organizationId: string) {
    return this.prisma.customerWallet.findMany({
      where: { customerId, organizationId },
      orderBy: [{ currencyCode: 'asc' }],
    });
  }

  async getMyOrders(
    customerId: string,
    organizationId: string,
    page = 1,
    limit = 20,
  ) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const where = { customerId, organizationId };

    const [items, total] = await Promise.all([
      this.prisma.customerOrganizationOrder.findMany({
        where,
        include: {
          customerEarningAmountDetail: { include: { coin: true } },
          customerBurningAmountDetail: {
            include: { cash: true, coin: true },
          },
          statusHistory: { orderBy: { timestamp: 'desc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.customerOrganizationOrder.count({ where }),
    ]);

    return {
      items,
      metadata: {
        currentPage: Math.max(page, 1),
        totalPages: Math.ceil(total / take),
        totalItems: total,
        itemsPerPage: take,
      },
    };
  }

  async getMyStatement(
    customerId: string,
    organizationId: string,
    currencyCode: string,
  ) {
    const wallet = await this.prisma.customerWallet.findUnique({
      where: {
        customer_id_organization_currency_code: {
          customerId,
          organizationId,
          currencyCode,
        },
      },
    });

    if (!wallet) {
      throw new CommonException(
        'Wallet not found for this organization and currency',
        StatusCodes.NOT_FOUND,
      );
    }

    const entries = await this.prisma.loyaltyLedgerEntry.findMany({
      where: { customerId, organizationId, currencyCode },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return { wallet, entries };
  }

  /**
   * Creates a delegated session for a customer the tenant has already
   * authenticated. The tenant identifies the customer with its own external
   * id or by phone number; the engine resolves the tenant scoped customer
   * and hands back a short lived token that is bound to that tenant.
   */
  async createCustomerSession(
    organizationId: string,
    form: {
      externalId?: string;
      phoneNumber?: string;
      countryCode?: string;
      name?: string;
    },
  ) {
    let customer: Customer | null = null;

    if (form.externalId) {
      const [error, existing] = await to(
        this.customerPrismaHelperService.findCustomerByExternalId(
          organizationId,
          form.externalId,
        ),
      );
      if (!error && existing) {
        customer = existing;
      }
    }

    if (!customer && form.phoneNumber) {
      const [error, existing] = await to(
        this.customerPrismaHelperService.findCustomerForOrganization({
          organizationId,
          phoneNumber: form.phoneNumber,
        }),
      );
      if (!error && existing) {
        customer = existing;
      }
    }

    if (!customer) {
      if (!form.phoneNumber) {
        throw new CommonException(
          'phoneNumber is required to create a customer for this organization',
          StatusCodes.BAD_REQUEST,
        );
      }

      customer =
        await this.customerPrismaHelperService.createCustomerForOrganization({
          organizationId,
          phoneNumber: form.phoneNumber,
          externalId: form.externalId,
          countryCode: form.countryCode || '91',
          name: form.name,
        });
    }

    const token = await this.authService.generateCustomerSessionToken(
      customer.id,
      organizationId,
    );

    return {
      token,
      expiresIn: CUSTOMER_SESSION_TOKEN_TTL,
      customer: { ...customer, token: '' },
    };
  }

  async findOrCreateCustomersAndProceedPhoneAuthentication(
    form: OtpPhoneFindOrCreateCustomerForm,
    organizationId: string,
  ) {
    const customer =
      await this.customerPrismaHelperService.findOrCreateCustomerByPhoneNumber(
        form,
        organizationId,
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
    organizationId: string,
  ): Promise<{ customer: Customer; customerWallets: any } | Customer> {
    if (balances) {
      const { customerWallet: customerWallets, ...customer } =
        await this.customerPrismaHelperService.findCustomerWithWalletBalances(
          { id },
          organizationId,
        );
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
      organizationId,
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
    cacheKeyParams: (args) => ({
      interval: args[0] || 48,
      organizationId: args[1],
    }),
  })
  async getTopCustomersForLeaderBoard(interval = 48, organizationId?: string) {
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
