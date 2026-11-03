import {
  ArgumentMetadata,
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

/**
 * Which route parameter this pipe is meant to validate.
 *
 * A pipe applied with `@UsePipes()` runs for *every* parameter of the handler,
 * including `@Query()`, `@Param()` and custom decorators such as
 * `@CurrentAuth()`. Without a target, a body schema would also be run against
 * those unrelated values and reject them. Declaring the target keeps a
 * method-level pipe scoped to the payload it was written for.
 */
export type JoiValidationTarget = 'body' | 'query' | 'param';

@Injectable()
export class JoiValidationPipe implements PipeTransform {
  constructor(
    private readonly schemaOrResolver: Joi.ObjectSchema | JoiSchemaResolver,
    private readonly target: JoiValidationTarget = 'body',
  ) {}

  transform(value: unknown, metadata?: ArgumentMetadata): unknown {
    if (metadata?.type && metadata.type !== this.target) {
      return value;
    }

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
