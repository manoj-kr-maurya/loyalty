import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import {
  BurningCoinAmountDetailsDto,
  CreateCustomerOrganizationOrderDto,
  CustomerBurningAmountDetailDto,
  FetchCustomerOrdersForCustomerQueryParams,
  FetchCustomerOrdersForOrganizationQueryParams,
  UpdateCustomerOrganizationOrderDto,
} from './DTO/customerOrganizationOrder.dto';
import {
  CustomerOrganizationOrder,
  CustomerOrganizationOrderStatus,
  OrganizationRoles,
  Prisma,
} from '@prisma/client';
import { OrganizationService } from '../organization/organization.service';
import { CampaignService } from '../campaign/campaign.service';
import {
  InsufficientPointsException,
  InvalidAmountException,
  OrganizationDoesntHaveEnoughCurrency,
} from './exceptions/customerOrganizationOrder.exception';
import {
  CustomerOrganizationOrderPrismaHelperService,
  CustomerOrganizationOrderWithDetails,
} from './customer-organization-order-prisma-helper.service';
import { PrismaService } from 'src/common/services/prismaService';
import { CustomerWalletService } from '../customer-wallets/customer-wallets.service';
import {
  CustomerBlockPoints,
  CustomerCreditPoints,
} from '../customer-wallets/DTO/customerWallets.dto';
import { CustomerOrganizationOrderJobProducer } from './jobs/producer';
import { CommonUtilsService } from 'src/common/utils/common-utils.service';
import { getPaginationMetadata } from 'src/common/utils/pagination.util';

const validTransitions = {
  INITIATED: [
    CustomerOrganizationOrderStatus.COMPLETED,
    CustomerOrganizationOrderStatus.CANCELLED,
    CustomerOrganizationOrderStatus.HOLD,
  ],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
  REFUNDED: [],
  HOLD: [
    CustomerOrganizationOrderStatus.COMPLETED,
    CustomerOrganizationOrderStatus.FAILED,
    CustomerOrganizationOrderStatus.CANCELLED,
  ],
};

@Injectable()
export class CustomerOrganizationOrderService {
  private readonly logger = new Logger(CustomerOrganizationOrderService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly organizationService: OrganizationService,
    private readonly campaignService: CampaignService,
    private readonly customerOrganizationOrderProducer: CustomerOrganizationOrderJobProducer,
    private readonly customerWalletService: CustomerWalletService,
    private readonly customerOrganizationOrderPrismaHelperService: CustomerOrganizationOrderPrismaHelperService,
    private readonly commonUtilsService: CommonUtilsService,
  ) {}

  async createCustomerOrganizationOrder(
    customerId: string,
    form: CreateCustomerOrganizationOrderDto,
  ): Promise<CustomerOrganizationOrder> {
    // Validate the burning amount details
    this.validateBurningAmountDetails(form.burningAmountDetails);

    const isThereACoin =
      form.burningAmountDetails.coin &&
      form.burningAmountDetails.coin.length > 0;

    // If coins are being burned, confirm the burning details
    if (isThereACoin) {
      await this.confirmBurningDetails(customerId, form.burningAmountDetails);
    }
    const organization = await this.organizationService.getOrganization(
      form.organizationId,
    );
    let potentialEarningFromActiveCampaigns;
    if (organization.role === OrganizationRoles.ADMIN) {
      potentialEarningFromActiveCampaigns =
        await this.campaignService.getActiveCampaignOfOrganizationAndTheirPotentialEarning(
          {
            realAmount: form.burningAmountDetails.cash.amount,
            organizationId: form.organizationId,
          },
        );
    } else if (organization.role === OrganizationRoles.SHOP) {
      potentialEarningFromActiveCampaigns =
        await this.campaignService.getActiveCampaignOfOrganizationAndTheirPotentialEarning(
          {
            realAmount: form.burningAmountDetails.cash.amount,
            organizationId: organization.orgAdminId,
          },
        );
    }
    const { earning } = this.calculateEarnings(
      potentialEarningFromActiveCampaigns,
    );

    return await this.prismaService.$transaction(async () => {
      const newOrder =
        await this.customerOrganizationOrderPrismaHelperService.createCustomerOrganizationOrder(
          {
            customer: { connect: { id: customerId } },
            organization: { connect: { id: form.organizationId } },
            physicalCurrency: 'INR',
            status: CustomerOrganizationOrderStatus.INITIATED,
            customerBurningAmountDetail: {
              create: {
                totalAmount: form.burningAmountDetails.totalAmount,
                cash: {
                  create: { amount: form.burningAmountDetails.cash.amount },
                },
                ...(isThereACoin && {
                  coin: {
                    createMany: { data: form.burningAmountDetails.coin },
                  },
                }),
              },
            },
            customerEarningAmountDetail: {
              create: {
                totalAmount: earning.totalAmount,
                coin: { createMany: { data: earning.coin } },
              },
            },
            statusHistory: {
              create: [
                {
                  status: CustomerOrganizationOrderStatus.INITIATED,
                  timestamp: new Date(),
                },
              ],
            },
          },
        );

      if (isThereACoin) {
        await this.initializeAndBlockPoints(
          customerId,
          form.burningAmountDetails.coin,
          newOrder.id,
        );
      }
      if (potentialEarningFromActiveCampaigns.length > 0) {
        await Promise.all(
          earning.coin.map(async (item) => {
            const initializedCustomerPointForEarning =
              await this.customerWalletService.initialize(
                customerId,
                item.currencyCode,
                this.prismaService,
              );
            await initializedCustomerPointForEarning.addPendingPoints({
              currencyCode: item.currencyCode,
              customerId,
              transactionRef: newOrder.id,
              amount: item.amount,
            });
            await initializedCustomerPointForEarning.save();
            return initializedCustomerPointForEarning;
          }),
        );
      }

      this.notifyOrganizationRegardingPotentialOrder(
        customerId,
        form,
        newOrder.id,
      );

      return newOrder;
    });
  }

  /**
   * Validates the burning amount details to ensure data consistency
   */
  private validateBurningAmountDetails(
    burningDetails: CustomerBurningAmountDetailDto,
  ): void {
    // Calculate the total from individual components
    let calculatedTotal = burningDetails.cash.amount;

    // Add coin amounts if present
    if (burningDetails.coin && burningDetails.coin.length > 0) {
      for (const coin of burningDetails.coin) {
        // Currently each coin is valued at 1 INR
        calculatedTotal += coin.amount;
      }
    }

    // Validate that the provided total matches the calculated total
    if (Math.abs(calculatedTotal - burningDetails.totalAmount) > 0.01) {
      throw new InvalidAmountException(calculatedTotal, {
        ...burningDetails,
        cash: { amount: burningDetails?.cash?.amount || 0 },
      });
    }
  }

  private async confirmBurningDetails(
    customerId: string,
    burningAmountDetails: CustomerBurningAmountDetailDto,
  ) {
    const customerPoints = await this.prismaService.customerWallet.findMany({
      where: {
        customerId,
        currencyCode: {
          in: burningAmountDetails.coin.map((element) => element.currencyCode),
        },
      },
    });

    const insufficientPoints = burningAmountDetails.coin.filter((coin) => {
      const customerPoint = customerPoints.find(
        (point) => point.currencyCode === coin.currencyCode,
      );
      return !customerPoint || customerPoint.availableBalance < coin.amount;
    });

    if (insufficientPoints.length > 0) {
      throw new InsufficientPointsException(insufficientPoints);
    }
  }
  private calculateEarnings(potentialEarningFromActiveCampaigns: any[]) {
    let totalAmount = 0;
    const coin: {
      currencyCode: string;
      amount: number;
      earningExpiresIn: number;
      organizationCampaignId: string;
    }[] = [];
    const currencyAmountMap = new Map<string, number>();

    for (const earning of potentialEarningFromActiveCampaigns) {
      totalAmount += earning.amount;
      coin.push({
        currencyCode: earning.currencyCode,
        amount: earning.amount,
        earningExpiresIn: earning.earningExpiresIn,
        organizationCampaignId: earning.organizationCampaignId,
      });

      // Accumulate the total amount for each currency code
      if (currencyAmountMap.has(earning.currencyCode)) {
        currencyAmountMap.set(
          earning.currencyCode,
          currencyAmountMap.get(earning.currencyCode) + earning.amount,
        );
      } else {
        currencyAmountMap.set(earning.currencyCode, earning.amount);
      }
    }
    return {
      earning: { coin, totalAmount },
    };
  }

  private async initializeAndBlockPoints(
    customerId: string,
    burningCoins: BurningCoinAmountDetailsDto[],
    orderId: string,
  ) {
    await Promise.all(
      burningCoins.map(async (coin) => {
        if (coin.amount > 0) {
          const initializedCustomerWallet =
            await this.customerWalletService.initialize(
              customerId,
              coin.currencyCode,
              this.prismaService,
            );
          const customerBlockPointsPayload: CustomerBlockPoints = {
            customerId,
            currencyCode: coin.currencyCode,
            amount: coin.amount,
            transactionRef: orderId,
          };
          await initializedCustomerWallet.blockPoints(
            customerBlockPointsPayload,
          );
          await initializedCustomerWallet.save();
        }
      }),
    );
  }

  async notifyOrganizationRegardingPotentialOrder(
    customerId: string,
    form: CreateCustomerOrganizationOrderDto,
    newOrderId: string,
  ) {
    const organization = await this.organizationService.getOrganization(
      form.organizationId,
    );
  }

  async fetchOrganizationCustomerOrdersPerCustomer(
    customerId: string,
    query: FetchCustomerOrdersForCustomerQueryParams,
  ) {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;
    const orderBy = { createdAt: 'desc' as const };

    // Build where condition with search
    const where: Prisma.CustomerOrganizationOrderWhereInput = {
      customerId,
      ...(search && {
        OR: [
          { id: { contains: search, mode: 'insensitive' } },
          { organization: { name: { contains: search, mode: 'insensitive' } } },
          { customerId: { contains: search, mode: 'insensitive' } },
          {
            customerBurningAmountDetail: {
              OR: [
                {
                  totalAmount: {
                    equals: !isNaN(parseFloat(search))
                      ? parseFloat(search)
                      : undefined,
                  },
                },
                {
                  coin: {
                    some: {
                      OR: [
                        {
                          currencyCode: {
                            contains: search,
                            mode: 'insensitive',
                          },
                        },
                        {
                          amount: {
                            equals: !isNaN(parseFloat(search))
                              ? parseFloat(search)
                              : undefined,
                          },
                        },
                      ],
                    },
                  },
                },
                {
                  cash: {
                    amount: {
                      equals: !isNaN(parseFloat(search))
                        ? parseFloat(search)
                        : undefined,
                    },
                  },
                },
              ],
            },
          },
          {
            customerEarningAmountDetail: {
              OR: [
                {
                  totalAmount: {
                    equals: !isNaN(parseFloat(search))
                      ? parseFloat(search)
                      : undefined,
                  },
                },
                {
                  coin: {
                    some: {
                      OR: [
                        {
                          currencyCode: {
                            contains: search,
                            mode: 'insensitive',
                          },
                        },
                        {
                          amount: {
                            equals: !isNaN(parseFloat(search))
                              ? parseFloat(search)
                              : undefined,
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        ],
      }),
    };

    // Perform parallel queries for orders and total count
    const [cusOrders, totalItems] = await Promise.all([
      this.customerOrganizationOrderPrismaHelperService.findCustomerOrganizationOrders(
        where,
        orderBy,
        limit,
        skip,
      ),
      this.customerOrganizationOrderPrismaHelperService.countCustomerOrganizationOrders(
        where,
      ),
    ]);

    // Generate pagination metadata
    const metadata = getPaginationMetadata(totalItems, page, limit);

    return {
      cusOrders,
      metadata,
    };
  }

  async fetchPotentialOrder(id: string) {
    return await this.customerOrganizationOrderPrismaHelperService.findCustomerOrganizationOrder(
      {
        id,
      },
    );
  }

  async fetchOrganizationCustomerOrders(
    organizationId: string,
    query: FetchCustomerOrdersForOrganizationQueryParams,
  ) {
    // Destructure pagination and filter parameters with defaults
    const { page = 1, limit = 10, status, startDate, endDate } = query;

    // Calculate pagination parameters
    const skip = (page - 1) * limit;
    const orderBy = { createdAt: 'desc' as const };

    // Get organization data
    const organization = await this.organizationService.getOrganization(
      organizationId,
    );

    // Determine which organizations to fetch orders for
    const whereCondition: Prisma.CustomerOrganizationOrderWhereInput = {};

    if (organization.role === OrganizationRoles.SHOP) {
      // For shop role, only fetch orders for this organization
      whereCondition.organizationId = organizationId;
    } else {
      // For non-shop roles
      if (query.shopId) {
        // If specific shop is selected, fetch for that shop only
        whereCondition.organizationId = query.shopId;
      } else {
        // Get all invited shops and include current organization
        const shops =
          await this.organizationService.getInvitedShopsAsOrganizationData(
            organizationId,
          );
        const shopIds = [...shops.map((shop) => shop.id), organizationId];
        whereCondition.organizationId = { in: shopIds };
      }
    }

    // Add status filter if provided
    if (status) {
      whereCondition.status = status;
    }

    // Add date range filter if dates are provided
    if (startDate || endDate) {
      whereCondition.createdAt = {};

      if (startDate) {
        whereCondition.createdAt.gte = startDate;
      }

      if (endDate) {
        // Set endDate to the end of the day
        const adjustedEndDate = new Date(endDate);
        adjustedEndDate.setHours(23, 59, 59, 999);
        whereCondition.createdAt.lte = adjustedEndDate;
      }
    }

    // Perform parallel queries for orders and total count
    const [orders, totalItems] = await Promise.all([
      this.customerOrganizationOrderPrismaHelperService.findCustomerOrganizationOrders(
        whereCondition,
        orderBy,
        limit,
        skip,
      ),
      this.customerOrganizationOrderPrismaHelperService.countCustomerOrganizationOrders(
        whereCondition,
      ),
    ]);

    // Generate pagination metadata
    const metadata = getPaginationMetadata(totalItems, page, limit);

    return {
      orders,
      metadata,
    };
  }
  async handleUpdateCustomerOrganizationOrder(
    form: UpdateCustomerOrganizationOrderDto,
  ) {
    return await this.prismaService.$transaction(async () => {
      const order: CustomerOrganizationOrderWithDetails =
        await this.customerOrganizationOrderPrismaHelperService.findCustomerOrganizationOrderWithAllNestedDetails(
          { id: form.orderId },
        );

      if (!validTransitions[order.status].includes(form.status)) {
        throw new BadRequestException(
          `Invalid status transition from ${order.status} to ${form.status}`,
        );
      }

      order.status = form.status;

      await this.customerOrganizationOrderPrismaHelperService.createStatusHistory(
        {
          status: form.status,
          timestamp: new Date(),
          customerOrganizationOrder: { connect: { id: order.id } },
        },
        this.prismaService,
      );

      if (form.status === CustomerOrganizationOrderStatus.COMPLETED) {
        await this.handleOrderCompletion(order);
      } else if (
        form.status === CustomerOrganizationOrderStatus.CANCELLED ||
        form.status === CustomerOrganizationOrderStatus.FAILED
      ) {
        await this.handleOrderCancellationOrFailure(order);
      }

      return await this.customerOrganizationOrderPrismaHelperService.updateCustomerOrganizationOrder(
        { id: order.id },
        { status: form.status },
      );
    });
  }

  private async handleOrderCompletion(
    order: CustomerOrganizationOrderWithDetails,
  ) {
    const pointsToCreditToCustomer: CustomerCreditPoints[] =
      order.customerEarningAmountDetail.coin.map((item) => {
        return {
          customerId: order.customerId,
          transactionRef: order.id,
          amount: item.amount,
          expiryDate: this.commonUtilsService.getTimeFromCampaignExpiryEnum(
            item.earningExpiresIn,
          ),
          currencyCode: item.currencyCode,
        };
      });

    await this.adjustOrganizationCurrencyWallets(
      order.organizationId,
      pointsToCreditToCustomer,
      order.customerBurningAmountDetail.coin,
    );
    await this.customerOrganizationOrderProducer.addHandleCustomerOrganizationOrderCompletingJob(
      {
        customerId: order.customerId,
        transactionRef: order.id,
        earnings: pointsToCreditToCustomer,
        burningAmountDetails: order.customerBurningAmountDetail,
      },
    );
  }

  private async handleOrderCancellationOrFailure(order) {
    await Promise.all(
      order.customerBurningAmountDetail.coin.map(async (coin) => {
        if (coin.amount > 0) {
          const initializedPoints = await this.customerWalletService.initialize(
            order.customerId,
            coin.currencyCode,
          );
          await initializedPoints.unblockPoints({
            currencyCode: coin.currencyCode,
            customerId: order.customerId,
            transactionRef: order.id,
          });
          await initializedPoints.save();
        }
      }),
    );
    await Promise.all(
      order.customerEarningAmountDetail.coin.map(async (coin) => {
        if (coin.amount > 0) {
          const initializedPoints = await this.customerWalletService.initialize(
            order.customerId,
            coin.currencyCode,
          );
          await initializedPoints.cancelPendingPoints({
            currencyCode: coin.currencyCode,
            customerId: order.customerId,
            transactionRef: order.id,
          });
          await initializedPoints.save();
        }
      }),
    );
  }
  async adjustOrganizationCurrencyWallets(
    organizationId: string,
    pointsToCreditToCustomer?: CustomerCreditPoints[],
    pointsThatCustomerIsUsing?: BurningCoinAmountDetailsDto[],
  ) {
    // Retrieve the organization with its currency buckets
    let organization =
      await this.organizationService.getOrganizationWithCurrenciesAndCurrencyBuckets(
        organizationId,
      );
    if (organization.role === OrganizationRoles.SHOP) {
      organization =
        await this.organizationService.getOrganizationWithCurrenciesAndCurrencyBuckets(
          organization.orgAdminId,
        );
    }
    // Create a map to store the updates for each currency bucket
    const bucketUpdates = new Map<
      string,
      {
        availableAmount?: number;
        distributedAmount?: number;
        receivedAmount?: number;
      }
    >();

    if (
      pointsToCreditToCustomer.length &&
      pointsToCreditToCustomer.length > 0
    ) {
      // Iterate through each pointToCredit and calculate updates
      for (const pointToCredit of pointsToCreditToCustomer) {
        const currencyBucket = organization.currencyBuckets.find(
          (bucket) => bucket.code === pointToCredit.currencyCode,
        );
        if (!currencyBucket) {
          throw new OrganizationDoesntHaveEnoughCurrency();
        }

        // Get current amounts from updates if available, otherwise use original values
        const currentUpdate = bucketUpdates.get(currencyBucket.id) || {
          availableAmount: currencyBucket.availableAmount,
          distributedAmount: currencyBucket.distributedAmount,
        };

        if (currentUpdate.availableAmount < pointToCredit.amount) {
          throw new OrganizationDoesntHaveEnoughCurrency();
        }

        // Calculate new amounts using the accumulated values
        currentUpdate.availableAmount -= pointToCredit.amount;
        currentUpdate.distributedAmount += pointToCredit.amount;

        bucketUpdates.set(currencyBucket.id, currentUpdate);
      }
    }

    if (pointsThatCustomerIsUsing) {
      // Iterate through each pointToUse and calculate updates
      for (const pointToUse of pointsThatCustomerIsUsing) {
        const currencyBucket = organization.currencyBuckets.find(
          (bucket) => bucket.code === pointToUse.currencyCode,
        );

        const newReceivedAmount =
          currencyBucket.receivedAmount + pointToUse.amount;

        // Store the updates
        bucketUpdates.set(currencyBucket.id, {
          ...bucketUpdates.get(currencyBucket.id),
          receivedAmount: newReceivedAmount,
        });
      }
    }

    // Perform a single bulk update operation
    await Promise.all(
      Array.from(bucketUpdates.entries()).map(([bucketId, updates]) =>
        this.prismaService.currencyBucket.update({
          where: { id: bucketId },
          data: updates,
        }),
      ),
    );
  }
}
