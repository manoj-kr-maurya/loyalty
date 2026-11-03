import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import * as Joi from 'joi';
import { JoiValidationPipe } from './joi-validation.pipe';
import { buildSchemaForOrg } from '../validation/validation-policies';

const bodyMetadata: ArgumentMetadata = { type: 'body' };
const queryMetadata: ArgumentMetadata = { type: 'query' };
const paramMetadata: ArgumentMetadata = { type: 'param' };
const customMetadata: ArgumentMetadata = { type: 'custom' };

const BASE_SCHEMA = Joi.object({
  organizationId: Joi.string().required(),
  name: Joi.string().required(),
  couponValue: Joi.number().min(0).optional(),
  channels: Joi.array()
    .items(Joi.string().valid('app', 'web', 'mweb', 'all'))
    .optional(),
});

describe('JoiValidationPipe with org-aware schema resolver', () => {
  it('uses the base schema for organizations without a policy', () => {
    const pipe = new JoiValidationPipe((value: any) =>
      buildSchemaForOrg(BASE_SCHEMA, value?.organizationId),
    );
    const result = pipe.transform({
      organizationId: 'org-no-policy',
      name: 'X',
      couponValue: 500,
    });
    expect(result).toMatchObject({
      organizationId: 'org-no-policy',
      name: 'X',
      couponValue: 500,
    });
  });

  it('enforces org-specific couponValue cap for a policy org', () => {
    const pipe = new JoiValidationPipe((value: any) =>
      buildSchemaForOrg(BASE_SCHEMA, value?.organizationId),
    );
    expect(() =>
      pipe.transform({
        organizationId: '837647b4-b07b-402f-8887-8247bc74d1b3',
        name: 'X',
        couponValue: 90,
      }),
    ).toThrow(BadRequestException);
  });

  it('passes valid payloads for a policy org', () => {
    const pipe = new JoiValidationPipe((value: any) =>
      buildSchemaForOrg(BASE_SCHEMA, value?.organizationId),
    );
    const result = pipe.transform({
      organizationId: '837647b4-b07b-402f-8887-8247bc74d1b3',
      name: 'X',
      couponValue: 20,
      channels: ['app'],
    });
    expect(result).toMatchObject({ couponValue: 20, channels: ['app'] });
  });

  it('requires channels for a policy org that mandates them', () => {
    const pipe = new JoiValidationPipe((value: any) =>
      buildSchemaForOrg(BASE_SCHEMA, value?.organizationId),
    );
    expect(() =>
      pipe.transform({
        organizationId: '837647b4-b07b-402f-8887-8247bc74d1b3',
        name: 'X',
        couponValue: 20,
      }),
    ).toThrow(BadRequestException);
  });

  it('still works with a static schema (backward compatible)', () => {
    const pipe = new JoiValidationPipe(BASE_SCHEMA);
    const result = pipe.transform({
      organizationId: 'org-1',
      name: 'Y',
    }) as any;
    expect(result.name).toBe('Y');
  });
});

describe('JoiValidationPipe parameter targeting', () => {
  const bodySchema = Joi.object({
    customerId: Joi.string().required(),
    burningAmountDetails: Joi.object({
      totalAmount: Joi.number().required(),
    }).required(),
  });

  it('validates the body payload', () => {
    const pipe = new JoiValidationPipe(bodySchema);
    const result = pipe.transform(
      { customerId: 'c-1', burningAmountDetails: { totalAmount: 10 } },
      bodyMetadata,
    ) as any;
    expect(result.customerId).toBe('c-1');
  });

  it('rejects an invalid body payload', () => {
    const pipe = new JoiValidationPipe(bodySchema);
    expect(() => pipe.transform({ customerId: 'c-1' }, bodyMetadata)).toThrow(
      BadRequestException,
    );
  });

  it('does not validate query, param or custom-decorator values with a body schema', () => {
    const pipe = new JoiValidationPipe(bodySchema);
    const authContext = { type: 'platform', scopes: ['*'] };

    expect(pipe.transform(authContext, customMetadata)).toBe(authContext);
    expect(pipe.transform('org-1', queryMetadata)).toBe('org-1');
    expect(pipe.transform('c-1', paramMetadata)).toBe('c-1');
  });

  it('validates the query when targeted at the query', () => {
    const querySchema = Joi.object({ currencyCode: Joi.string().required() });
    const pipe = new JoiValidationPipe(querySchema, 'query');

    expect(
      pipe.transform({ currencyCode: 'PTS' }, queryMetadata),
    ).toMatchObject({
      currencyCode: 'PTS',
    });
    expect(() => pipe.transform({}, queryMetadata)).toThrow(
      BadRequestException,
    );
    expect(pipe.transform({ customerId: 'c-1' }, bodyMetadata)).toMatchObject({
      customerId: 'c-1',
    });
  });
});
