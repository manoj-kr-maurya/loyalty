import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomerSessionGuard } from 'src/modules/auth/guards/customer-session.guard';
import { CurrentCustomer } from 'src/modules/auth/decorators/current-customer.decorator';
import { CommonException } from 'src/common/exceptions/common.exception';
import { StatusCodes } from 'src/common/enums/status-codes';
import { LoyaltyEngineService } from './loyalty-engine.service';
import { LedgerQueryService } from './services/ledger-query.service';
import { LedgerQueryDto } from './dto/ledger-query.dto';

/**
 * Customer-facing read endpoints. Authenticated with a tenant delegated
 * customer session; the customer id and the tenant always come from the
 * token, never from the request.
 */
@ApiTags('engines-loyalty-customer')
@ApiBearerAuth()
@UseGuards(CustomerSessionGuard)
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
    @Req() req: { organizationId: string },
    @Query() query: LedgerQueryDto,
  ) {
    if (query.organizationId && query.organizationId !== req.organizationId) {
      throw new CommonException(
        'organizationId does not match the session',
        StatusCodes.FORBIDDEN,
      );
    }

    return this.ledgerQuery.list(customerId, req.organizationId, query);
  }

  @Get('tier-status/:organizationId')
  @ApiOperation({ summary: "Get the authenticated customer's tier status" })
  async getMyTierStatus(
    @CurrentCustomer() customerId: string,
    @Req() req: { organizationId: string },
    @Param('organizationId') organizationId: string,
  ) {
    if (organizationId !== req.organizationId) {
      throw new CommonException(
        'organizationId does not match the session',
        StatusCodes.FORBIDDEN,
      );
    }

    return this.loyaltyEngine.getCustomerTier(customerId, req.organizationId);
  }
}
