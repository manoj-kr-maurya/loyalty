import { UnprocessableEntityException } from '@nestjs/common';
import { CustomerWalletResponseCodes } from '../enums/responseCodes';
import { CustomerWalletPocketTransactionStatus } from '@prisma/client';

export class CustomerWalletNotFoundException extends UnprocessableEntityException {
  constructor(organizationId: string, currencyCode: string) {
    super({
      error: `Currency wallet not found for organization ${organizationId} and currency ${currencyCode}`,
      errorCode: CustomerWalletResponseCodes.Currency_Wallet_Not_Found,
    });
  }
}

export class InsufficientCurrencyBalanceException extends UnprocessableEntityException {
  constructor(
    availableBalance: number,
    requestedAmount: number,
    currencyCode: string,
  ) {
    super({
      error: `Insufficient balance. Available: ${availableBalance} ${currencyCode}, Requested: ${requestedAmount} ${currencyCode}`,
      errorCode: CustomerWalletResponseCodes.Points_Not_Enough,
    });
  }
}

export class TransactionNotFoundException extends UnprocessableEntityException {
  constructor(
    transactionRef: string,
    type: CustomerWalletPocketTransactionStatus,
  ) {
    super({
      error: `No ${type} transactions found with transaction reference: ${transactionRef}`,
      errorCode: CustomerWalletResponseCodes.No_Blocked_Transactions_Found,
    });
  }
}
