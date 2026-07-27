export enum LongListEnumOfAgendaJobs {
  // Currency Jobs
  ADD_NEW_CURRENCY_BUCKET_TO_ORG = 'addNewCurrencyBucketToOrg',

  // Customer Organization Order Jobs
  HANDLE_ONE_STEP_CREDIT_POINTS = 'handleOneStepCreditPoints',
  HANDLE_BLOCKING_CUSTOMER_POINTS = 'handleBlockingCustomerPoints',
  HANDLE_DEBITING_BLOCKED_POINTS = 'handleDebitingBlockedPoints',
  INITIALIZE_CUSTOMER_POINTS = 'initializeCustomerPoints',
  HANDLE_CUSTOMER_ORGANIZATION_ORDER_COMPLETING = 'handleCustomerOrganizationOrderCompleting',

  // Customer Wallet Jobs
  HANDLE_FULFILL_POINTS_EXPIRY = 'handleFulfillPointsExpiry',
  HANDLE_BLOCK_POINTS_UNBLOCKING = 'handleBlockPointsUnblocking',

  // Campaign Jobs
  CAMPAIGN_EXPIRY_REMINDER = 'campaignExpiryReminder',
}
