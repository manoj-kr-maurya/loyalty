import {
  PipeTransform,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import * as Joi from 'joi';

/**
 * Resolves the Joi schema to validate against at runtime, given the raw
 * payload. Used for organization-aware validation (schema may vary by org).
 */
export type JoiSchemaResolver = (value: unknown) => Joi.Schema;

@Injectable()
export class JoiValidationPipe implements PipeTransform {
  constructor(
    private readonly schemaOrResolver: Joi.ObjectSchema | JoiSchemaResolver,
  ) {}

  transform(value: unknown): unknown {
    const schema =
      typeof this.schemaOrResolver === 'function'
        ? this.schemaOrResolver(value)
        : this.schemaOrResolver;

    const { error, value: validated } = schema.validate(value, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const messages = error.details.map((d) => d.message).join('; ');
      throw new BadRequestException(messages);
    }

    return validated;
  }
}