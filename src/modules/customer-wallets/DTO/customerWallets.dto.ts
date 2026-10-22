import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CustomerWalletPocketTransaction,
  CustomerWalletPocketTransactionStatus,
} from '@prisma/client';
import {
  IsDate,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { CustomerBurningAmountDetailDto } from 'src/modules/customer-organization-order/DTO/customerOrganizationOrder.dto';

export class CurrencyForm {
  @ApiProperty({
    description: `Currency code`,
    example: 'KFC',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  currencyCode!: string;
}

export class CustomerPointsTransactionsForm {
  @ApiProperty({
    description: `customerPoints id`,
    example: '24895623498r298r7',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  customerPointsId!: string;
}

export class CustomerAddPendingPoints extends CurrencyForm {
  @ApiProperty({
    description: `Quantity of points`,
    example: 86,
    type: Number,
  })
  @IsNumber()
  amount: number;

  @ApiProperty({
    description: `Customer's Id`,
    example: '46893b4de982d77832e628782',
    type: String,
  })
  @IsString()
  customerId: string;

  @ApiProperty({
    description: `Reference for the pending points`,
    example: '46893b4de982d77832e628782',
    type: String,
  })
  @IsString()
  transactionRef: string;
}

export class CustomerBlockPoints extends CurrencyForm {
  @ApiProperty({
    description: `Quantity of points`,
    example: 86,
    type: Number,
  })
  @IsNumber()
  amount: number;

  @ApiProperty({
    description: `Customer's Id`,
    example: '46893b4de982d77832e628782',
    type: String,
  })
  @IsString()
  customerId: string;

  @ApiProperty({
    description: `Reference for the pending points`,
    example: '46893b4de982d77832e628782',
    type: String,
  })
  @IsString()
  transactionRef: string;

  @ApiPropertyOptional({
    description: `In how many minutes these points should unblock. -1 for never unblocking automatically`,
    example: '10',
  })
  @IsOptional()
  @IsNotEmpty()
  @IsNumber()
  unblockInMinutes?: number;
}

export class CustomerDebitAfterBlockPoints extends CurrencyForm {
  @ApiProperty({
    description: `Customer's Id`,
    example: '46893b4de982d77832e628782',
    type: String,
  })
  @IsString()
  customerId: string;

  @ApiProperty({
    description: `Reference for the pending points`,
    example: '46893b4de982d77832e628782',
    type: String,
  })
  @IsString()
  transactionRef: string;
}

export class CustomerDebitPoints extends CurrencyForm {
  @ApiProperty({
    description: `Customer's Id`,
    example: '46893b4de982d77832e628782',
    type: String,
  })
  @IsString()
  customerId: string;

  @ApiProperty({
    description: `Reference for the pending points`,
    example: '46893b4de982d77832e628782',
    type: String,
  })
  @IsString()
  transactionRef: string;

  @ApiProperty({
    description: `Amount`,
    example: 33,
    type: Number,
  })
  @IsNumber()
  amount: number;
}

export class CustomerCreditPoints extends CurrencyForm {
  @ApiProperty({
    description: `Customer's Id`,
    example: '46893b4de982d77832e628782',
    type: String,
  })
  @IsString()
  customerId: string;

  @ApiProperty({
    description: `Reference for the pending points`,
    example: '46893b4de982d77832e628782',
    type: String,
  })
  @IsString()
  transactionRef: string;

  @ApiProperty({
    description: `Amount`,
    example: 33,
    type: Number,
  })
  @IsNumber()
  amount: number;

  @ApiProperty({
    description: `Expiry date of the points in the format dd-mm-yyyy`,
    example: '2023-12-31',
  })
  @IsDate()
  expiryDate: Date;
}

export class CustomerCreditPendingPoints extends CurrencyForm {
  @ApiProperty({
    description: `Customer's Id`,
    example: '46893b4de982d77832e628782',
    type: String,
  })
  @IsString()
  customerId: string;

  @ApiProperty({
    description: `Reference for the pending points`,
    example: '46893b4de982d77832e628782',
    type: String,
  })
  @IsString()
  transactionRef: string;

  @ApiPropertyOptional({
    description: `Expiry date of the points in the format yyyy-mm-dd`,
    example: '2023-12-31',
  })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}

export class CustomerUnblockPoints extends CurrencyForm {
  @ApiProperty({
    description: `Customer's Id`,
    example: '46893b4de982d77832e628782',
    type: String,
  })
  @IsString()
  customerId: string;

  @ApiProperty({
    description: `Reference for the pending points`,
    example: '46893b4de982d77832e628782',
    type: String,
  })
  @IsString()
  transactionRef: string;
}

export interface handleBlockPointsAutoUnblockingJobData {
  newTransaction: CustomerWalletPocketTransaction;
  customerId: string;
  currencyCode: string;
}

export interface handleOneStepCreditPointsJobData {
  data: CustomerCreditPoints;
}

export interface handleBlockingCustomerPointsJobData {
  data: CustomerBlockPoints;
}

export interface handleDebitingBlockedCustomerPointsJobData {
  data: CustomerDebitAfterBlockPoints;
}

export interface handleRemoveAutoUnBlockJobData {
  transactionRef: string;
  customerPointsId: string;
}
export interface handlePointsExpiryJobData {
  newTransaction: CustomerWalletPocketTransaction;
  pointsId: string;
  currencyCode: string;
}

export interface handleFulfillPointsExpiryJobData {
  newTransaction: CustomerWalletPocketTransaction;
  pointsId: string;
  currencyCode: string;
}

export interface handleReversalTransactionJobData {
  transactionRef: string;
  currencyCode: string;
  customerId: string;
  reversalTime: Date;
  status: CustomerWalletPocketTransactionStatus;
}

export interface initializePointsJobData {
  customerId: string;
  currencyCode: string;
}
export interface handleInitializeCustomerPointsJobData {
  data: initializePointsJobData;
}

export interface customerOrganizationOrderCompletingJobData {
  customerId: string;
  transactionRef: string;
  earnings: CustomerCreditPoints[];
  burningAmountDetails: CustomerBurningAmountDetailDto;
}

export interface handleCustomerOrganizationOrderCompletingJobData {
  data: customerOrganizationOrderCompletingJobData;
}
