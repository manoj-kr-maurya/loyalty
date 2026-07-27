import { envEnums, Environments } from './enums';

export interface DBVariables {
  [envEnums.LSB_PG_URL]: string;
  [envEnums.AGENDA_MONGO_DB_URI]: string;
}

export interface ServerSettingsEnvVariables {
  [envEnums.PORT]: number;
  [envEnums.ENVIRONMENT]: Environments;
}

export interface IdentityJWTEnvVariables {
  [envEnums.JWT_SECRET]: string;
}

export interface RedisVariables {
  [envEnums.REDIS_PASSWORD]: string;
  [envEnums.REDIS_HOST]: string;
  [envEnums.REDIS_PORT]: number;
}

export interface MailerVariables {
  [envEnums.SENDER_MAIL]: string;
  [envEnums.SENDER_PASSWORD]: string;
}

export interface OTPVariables {
  [envEnums.OTP_TIME_OUT_MINUTES]: number;
}

export interface ExternalServiceBaseUrlsVariables {
  [envEnums.PHONEPE_BASE_URL]: string;
  [envEnums.FACTOR2_API_BASE_URL]: string;
  [envEnums.IMGBB_API_BASE_URL]: string;
}

export interface PhonepeConfVariables {
  [envEnums.PHONEPE_SALT_KEY]: string;
  [envEnums.PHONEPE_MERCHANT_ID]: string;
}

export interface KeysThatIGaveTo3rdParties {
  [envEnums.ADMIN_API_KEY]: string;
}

export interface Factor2ConfVariables {
  [envEnums.FACTOR2_API_KEY]: string;
}

export interface CampaignPreRequisiteVariables {
  [envEnums.MINIMUM_CAMPAIGN_AMOUNT_IN_INR]: string;
}

export interface IMGBBVariables {
  [envEnums.IMGBB_API_KEY]: string;
}

export interface CampaignExpiryNotificationSettings {
  [envEnums.CAMPAIGN_REMINDER_DAYS]: number;
}

export interface TestingPhoneNumbers {
  [envEnums.COMMA_SEPARATED_TESTING_PHONE_NUMBERS]: string;
}

export interface PrimaryDBVariables {
  [envEnums.PG_DB_HOST]: string;
  [envEnums.PG_DB_PORT]: number;
  [envEnums.PG_DB_NAME]: string;
  [envEnums.PG_DB_USER]: string;
  [envEnums.PG_DB_PASSWORD]: string;
}

export interface EnvironmentVariables
  extends DBVariables,
    ServerSettingsEnvVariables,
    IdentityJWTEnvVariables,
    RedisVariables,
    MailerVariables,
    OTPVariables,
    ExternalServiceBaseUrlsVariables,
    PhonepeConfVariables,
    KeysThatIGaveTo3rdParties,
    Factor2ConfVariables,
    CampaignPreRequisiteVariables,
    IMGBBVariables,
    CampaignExpiryNotificationSettings,
    TestingPhoneNumbers,
    PrimaryDBVariables {}
