import { BadRequestException } from '@nestjs/common';
import * as Joi from 'joi';
import { JoiValidationPipe } from './joi-validation.pipe';
import { buildSchemaForOrg } from '../validation/validation-policies';

const BASE_SCHEMA = Joi.object({
  organizationId: Joi.string().required(),
  name: Joi.string().required(),
  couponValue: Joi.number().min(0).optional(),
  channels: Joi.array().items(Joi.string().valid('app', 'web', 'mweb', 'all')).optional(),
});

describe('JoiValidationPipe with org-aware schema resolver', () => {
  it('uses the base schema for organizations without a policy', () => {
    const pipe = new JoiValidationPipe((value: any) => buildSchemaForOrg(BASE_SCHEMA, value?.organizationId));
    const result = pipe.transform({ organizationId: 'org-no-policy', name: 'X', couponValue: 500 });
    expect(result).toMatchObject({ organizationId: 'org-no-policy', name: 'X', couponValue: 500 });
  });

  it('enforces org-specific couponValue cap for a policy org', () => {
    const pipe = new JoiValidationPipe((value: any) => buildSchemaForOrg(BASE_SCHEMA, value?.organizationId));
    expect(() =>
      pipe.transform({ organizationId: '837647b4-b07b-402f-8887-8247bc74d1b3', name: 'X', couponValue: 90 }),
    ).toThrow(BadRequestException);
  });

  it('passes valid payloads for a policy org', () => {
    const pipe = new JoiValidationPipe((value: any) => buildSchemaForOrg(BASE_SCHEMA, value?.organizationId));
    const result = pipe.transform({
      organizationId: '837647b4-b07b-402f-8887-8247bc74d1b3',
      name: 'X',
      couponValue: 20,
      channels: ['app'],
    });
    expect(result).toMatchObject({ couponValue: 20, channels: ['app'] });
  });

  it('requires channels for a policy org that mandates them', () => {
    const pipe = new JoiValidationPipe((value: any) => buildSchemaForOrg(BASE_SCHEMA, value?.organizationId));
    expect(() =>
      pipe.transform({ organizationId: '837647b4-b07b-402f-8887-8247bc74d1b3', name: 'X', couponValue: 20 }),
    ).toThrow(BadRequestException);
  });

  it('still works with a static schema (backward compatible)', () => {
    const pipe = new JoiValidationPipe(BASE_SCHEMA);
    const result = pipe.transform({ organizationId: 'org-1', name: 'Y' }) as any;
    expect(result.name).toBe('Y');
  });
});