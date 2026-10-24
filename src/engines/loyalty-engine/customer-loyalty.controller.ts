import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomerJwtGuard } from 'src/modules/auth/guards/customer-jwt.guard';
import { CurrentCustomer } from 'src/modules/auth/decorators/current-customer.decorator';
import { CommonException } from 'src/common/exceptions/common.exception';
import { StatusCodes } from 'src/common/enums/status-codes';
import { LoyaltyEngineService } from './loyalty-engine.service';
import { LedgerQueryService } from './services/ledger-query.service';
import { LedgerQueryDto } from './dto/ledger-query.dto';

/**
 * Customer-facing read endpoints. Authenticated with a customer JWT; the
 * customer id always comes from the token, never from the request.
 */
@ApiTags('engines-loyalty-customer')
@ApiBearerAuth()
@UseGuards(CustomerJwtGuard)
@Controller('engines/loyalty/customer')
export class CustomerLoyaltyController {
  constructor(
    private readonly loyaltyEngine: LoyaltyEngineService,
    private readonly ledgerQuery: LedgerQueryService,
  ) {}

  @Get('ledger')
  @ApiOperation({ summary: "List the authenticated customer's loyalty ledger" })
  async getMyLedger(
    @CurrentCustomer() customerId: string,
    @Query() query: LedgerQueryDto,
  ) {
    if (!query.organizationId) {
      throw new CommonException(
        'organizationId is required',
        StatusCodes.BAD_REQUEST,
      );
    }

    return this.ledgerQuery.list(customerId, query.organizationId, query);
  }

  @Get('tier-status/:organizationId')
  @ApiOperation({ summary: "Get the authenticated customer's tier status" })
  async getMyTierStatus(
    @CurrentCustomer() customerId: string,
    @Param('organizationId') organizationId: string,
  ) {
    return this.loyaltyEngine.getCustomerTier(customerId, organizationId);
  }
}
