import { envSchema } from './env-schema';

const requiredConfig = {
  LSB_PG_URL: 'postgres://localhost:5432/test',
  JWT_SECRET: 'test-secret',
  REDIS_PASSWORD: 'redis-password',
  SENDER_MAIL: 'sender@example.com',
  SENDER_PASSWORD: 'mail-password',
  PHONEPE_BASE_URL: 'https://phonepe.example.com',
  PHONEPE_SALT_KEY: 'phonepe-salt',
  PHONEPE_MERCHANT_ID: 'merchant-id',
  ADMIN_API_KEY: 'admin-api-key',
  FACTOR2_API_BASE_URL: 'https://factor2.example.com',
  FACTOR2_API_KEY: 'factor2-key',
  MINIMUM_CAMPAIGN_AMOUNT_IN_INR: '10',
  IMGBB_API_KEY: 'imgbb-key',
  IMGBB_API_BASE_URL: 'https://imgbb.example.com',
  CAMPAIGN_REMINDER_DAYS: '7',
  COMMA_SEPARATED_TESTING_PHONE_NUMBERS: '9999999999',
  PG_DB_HOST: 'localhost',
  PG_DB_PORT: '5432',
  PG_DB_NAME: 'loyalty',
  PG_DB_USER: 'postgres',
  PG_DB_PASSWORD: 'postgres',
};

const validate = (overrides: Record<string, unknown> = {}) =>
  envSchema.validate({ ...requiredConfig, ...overrides } as any);

describe('envSchema', () => {
  it('returns the coerced boolean instead of the raw "false" string', () => {
    const { error, value } = validate({ CUSTOMER_OTP_ENABLED: 'false' });

    expect(error).toBeNull();
    expect(value).toMatchObject({ CUSTOMER_OTP_ENABLED: false });
  });

  it('coerces other booleans and numbers to their declared types', () => {
    const { error, value } = validate({
      REDIS_TLS: 'true',
      PORT: '3003',
      OTP_TIME_OUT_MINUTES: '10',
    });

    expect(error).toBeNull();
    expect(value).toMatchObject({
      REDIS_TLS: true,
      PORT: 3003,
      OTP_TIME_OUT_MINUTES: 10,
    });
  });

  it('applies defaults for absent optional values', () => {
    const { error, value } = validate();

    expect(error).toBeNull();
    expect(value).toMatchObject({
      CUSTOMER_OTP_ENABLED: false,
      REDIS_TLS: false,
      PORT: 3003,
      REDIS_HOST: 'localhost',
    });
  });

  it('treats any value other than "true" or "1" as false', () => {
    const { error, value } = validate({ CUSTOMER_OTP_ENABLED: 'no' });

    expect(error).toBeNull();
    expect(value).toMatchObject({ CUSTOMER_OTP_ENABLED: false });
  });

  it('rejects a missing required value', () => {
    const { error } = envSchema.validate({
      ...requiredConfig,
      JWT_SECRET: undefined,
    } as any);

    expect(error).toBeInstanceOf(Error);
  });
});
