import * as Joi from 'joi';

/**
 * A per-organization validation policy.
 * `schemaOverrides` are merged on top of a base Joi schema, letting an
 * organization tighten/extend the shared contract (e.g. extra required
 * fields, stricter min/max, restricted enums) without changing base rules.
 */
export interface ValidationPolicy {
  schemaOverrides?: Joi.SchemaMap;
}

export type ValidationPolicyMap = Record<string, ValidationPolicy>;

/**
 * Code-mapped policy store (the default).
 *
 * Each organization key maps to an override policy. Organizations not listed
 * fall back to the shared/base schema. This is intentionally a plain module
 * (no DI) so it can be produced at controller-decorator evaluation time by
 * the schema factory. For runtime-editable rules, swap `getValidationPolicy`
 * for a database-backed lookup behind the same shape.
 */
const CODE_MAP_POLICIES: ValidationPolicyMap = {
  // Example organization-specific override: this org caps couponValue and
  // requires at least one channel so its offers are never unbounded.
  '837647b4-b07b-402f-8887-8247bc74d1b3': {
    schemaOverrides: {
      couponValue: Joi.number().min(1).max(50).messages({
        'number.max': 'couponValue must be at most 50 for this organization',
        'number.min': 'couponValue must be at least 1 for this organization',
      }),
      channels: Joi.array().items(Joi.string().valid('app', 'web', 'mweb', 'all')).min(1).required().messages({
        'array.min': 'channels is required for this organization',
        'any.required': 'channels is required for this organization',
      }),
    },
  },
};

/** Resolve the validation policy for an organization (empty = base schema). */
export function getValidationPolicy(organizationId?: string): ValidationPolicy {
  if (!organizationId) return {};
  return CODE_MAP_POLICIES[organizationId] ?? {};
}

/**
 * Build the effective Joi schema for an organization by merging its policy
 * overrides onto the shared base schema. Unknown orgs get the base schema.
 */
export function buildSchemaForOrg(
  baseSchema: Joi.ObjectSchema,
  organizationId?: string,
): Joi.ObjectSchema {
  const policy = getValidationPolicy(organizationId);
  if (policy.schemaOverrides) {
    return baseSchema.keys(policy.schemaOverrides);
  }
  return baseSchema;
}