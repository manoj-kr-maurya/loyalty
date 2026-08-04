/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Environments, envEnums } from './enums';
import { EnvironmentVariables } from './types';

type ValidationRule<T> = {
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  defaultValue: T | null;
  enumValues?: T[];
};

class CustomJOI {
  private validationRules: Partial<
    Record<keyof EnvironmentVariables, ValidationRule<any>>
  > = {};
  private currentKey: keyof EnvironmentVariables | null = null;

  string(key: keyof EnvironmentVariables) {
    this.currentKey = key;
    this.validationRules[key] = {
      type: 'string',
      required: false,
      defaultValue: null,
    };
    return this;
  }

  number(key: keyof EnvironmentVariables) {
    this.currentKey = key;
    this.validationRules[key] = {
      type: 'number',
      required: false,
      defaultValue: null,
    };
    return this;
  }

  boolean(key: keyof EnvironmentVariables) {
    this.currentKey = key;
    this.validationRules[key] = {
      type: 'boolean',
      required: false,
      defaultValue: null,
    };
    return this;
  }

  enum<T>(enumValues: T[]) {
    if (this.currentKey && this.validationRules[this.currentKey]) {
      this.validationRules[this.currentKey]!.enumValues = enumValues;
    }
    return this;
  }

  required() {
    if (this.currentKey && this.validationRules[this.currentKey]) {
      this.validationRules[this.currentKey]!.required = true;
    }
    return this;
  }

  default<T>(value: T) {
    if (this.currentKey && this.validationRules[this.currentKey]) {
      this.validationRules[this.currentKey]!.defaultValue = value;
    }
    return this;
  }

  validate(config: Partial<EnvironmentVariables>) {
    for (const key in this.validationRules) {
      const rule = this.validationRules[key as keyof EnvironmentVariables]!;
      let value =
        config[key as keyof EnvironmentVariables] ?? rule.defaultValue;

      if (rule.required && (value === undefined || value === null)) {
        return { error: new Error(`${key} is required`), value: null };
      }

      if (rule.type === 'number') {
        if (typeof value === 'string') {
          value = Number(value);
        }
        if (typeof value !== 'number' || isNaN(value)) {
          return { error: new Error(`${key} must be a number`), value: null };
        }
      }

      if (rule.type === 'boolean') {
        if (typeof value === 'string') {
          value = (value === 'true' || value === '1') as any;
        }
        if (typeof value !== 'boolean') {
          return { error: new Error(`${key} must be a boolean`), value: null };
        }
      }

      if (rule.type === 'string' && typeof value !== 'string') {
        return { error: new Error(`${key} must be a string`), value: null };
      }

      if (rule.enumValues && !rule.enumValues.includes(value)) {
        return {
          error: new Error(
            `${key} must be one of ${rule.enumValues.join(', ')}`,
          ),
          value: null,
        };
      }
    }

    return { error: null, value: config };
  }

  build() {
    return {
      rules: this.validationRules,
      validate: this.validate.bind(this),
    };
  }
}

const validator = new CustomJOI();

// Define the LSB_PG_URL as a required string
validator.string(envEnums.LSB_PG_URL).required();

// Define the AGENDA_MONGO_DB_URI as a required string
validator.string(envEnums.AGENDA_MONGO_DB_URI).required();
// Define the PORT as a required number with a default value of 3003
validator.number(envEnums.PORT).default(3003).required();

// Define the ENVIRONMENT as a required string with a default value of local, validated against the Environments enum
validator
  .string(envEnums.ENVIRONMENT)
  .default(Environments.local)
  .enum(Object.values(Environments))
  .required();

// Define the JWT_SECRET as a required string
validator.string(envEnums.JWT_SECRET).required();

// Define the REDIS_PASSWORD as a required string
validator.string(envEnums.REDIS_PASSWORD).required();

// Define the REDIS_HOST as a required string
validator.string(envEnums.REDIS_HOST).default('localhost');

// Define the REDIS_PORT as a required number
validator.number(envEnums.REDIS_PORT).default(6379).required();

// Define whether the Redis connection requires TLS (e.g. Upstash)
validator
  .boolean(envEnums.REDIS_TLS)
  .default(false)
  .required();

// Define the SENDER_MAIL as a required string
validator.string(envEnums.SENDER_MAIL).required();

// Define the SENDER_PASSWORD as a required string
validator.string(envEnums.SENDER_PASSWORD).required();

// Define the OTP_TIME_OUT_MINUTES as a required number with a default value of 10
validator.number(envEnums.OTP_TIME_OUT_MINUTES).default(10).required();

// Define the PHONEPE_BASE_URL as a required string
validator.string(envEnums.PHONEPE_BASE_URL).required();

// Define the PHONEPE_SALT_KEY as a required string
validator.string(envEnums.PHONEPE_SALT_KEY).required();

// Define the PHONEPE_MERCHANT_ID as a required string
validator.string(envEnums.PHONEPE_MERCHANT_ID).required();

// Define the ADMIN_API_KEY as a required string
validator.string(envEnums.ADMIN_API_KEY).required();

// Define the FACTOR2_API_BASE_URL as a required string
validator.string(envEnums.FACTOR2_API_BASE_URL).required();

// Define the FACTOR2_API_KEY as a required string
validator.string(envEnums.FACTOR2_API_KEY).required();

validator.number(envEnums.MINIMUM_CAMPAIGN_AMOUNT_IN_INR).required();

validator.string(envEnums.IMGBB_API_KEY).required();

validator.string(envEnums.IMGBB_API_BASE_URL).required();

validator.number(envEnums.CAMPAIGN_REMINDER_DAYS).required();
validator.string(envEnums.COMMA_SEPARATED_TESTING_PHONE_NUMBERS).required();

// Primary DB connection details
validator.string(envEnums.PG_DB_HOST).required();
validator.number(envEnums.PG_DB_PORT).required();
validator.string(envEnums.PG_DB_NAME).required();
validator.string(envEnums.PG_DB_USER).required();
validator.string(envEnums.PG_DB_PASSWORD).required();

// Build the validation schema
export const envSchema: {
  rules: Partial<Record<keyof EnvironmentVariables, ValidationRule<any>>>;
  validate: (config: Partial<EnvironmentVariables>) => {
    error: Error | null;
    value: Partial<EnvironmentVariables> | null;
  };
} = validator.build();

// Note to self: Default without presence of an actual variable in .env, doesnt work while fetching.
