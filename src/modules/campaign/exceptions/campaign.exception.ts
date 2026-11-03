import { UnprocessableEntityException } from '@nestjs/common';
import { CampaignResponseCodes } from '../enums/responseCodes';

export class AlreadyAnActiveCampaignExistsException extends UnprocessableEntityException {
  constructor() {
    super({
      error: `Already an active campaign exists, Either use a force flag or make the other campaign inactive.`,
      errorCode: CampaignResponseCodes.Campaign_Already_Active,
    });
  }
}

export class OverlappingCampaignsNotAllowedException extends UnprocessableEntityException {
  constructor(name: string) {
    super({
      error: `You are overlapping with campaign name: ${name}`,
      errorCode: CampaignResponseCodes.Overlapping_Campaigns_Not_Allowed,
    });
  }
}

export class CampaignAlreadyDeleted extends UnprocessableEntityException {
  constructor() {
    super({
      error: `Campaign is already deleted`,
      errorCode: CampaignResponseCodes.Campaign_Already_Deleted,
    });
  }
}

export class NotEnoughCurrencyWalletBalanceException extends UnprocessableEntityException {
  constructor(minimumBalanceRequired: number) {
    super({
      error: `You have to have atleast this much balance in your currency. ${minimumBalanceRequired}`,
      errorCode: CampaignResponseCodes.Not_Enough_Currency_Wallet_Balance,
    });
  }
}

export class NotAuthorisedToCreateCampaignException extends UnprocessableEntityException {
  constructor() {
    super({
      error: `You are not authorized to create campaign. Ask the Admin.`,
      errorCode: CampaignResponseCodes.Not_Authorised_To_Create_Campaign,
    });
  }
}
