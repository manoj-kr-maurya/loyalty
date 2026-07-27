import {
  UnprocessableEntityException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaResponseCodes } from './prisma-response-codes';

export class UniqueConstraintViolationException extends ConflictException {
  constructor(detail: string) {
    super({
      error: 'Unique constraint violation',
      errorCode: PrismaResponseCodes.Unique_Constraint_Violation,
      detail,
    });
  }
}

export class RecordNotFoundException extends UnprocessableEntityException {
  constructor(detail: string) {
    super({
      error: 'Record not found',
      errorCode: PrismaResponseCodes.Record_Not_Found,
      detail,
    });
  }
}

export class ForeignKeyConstraintFailedException extends BadRequestException {
  constructor(detail: string) {
    super({
      error: 'Foreign key constraint failed',
      errorCode: PrismaResponseCodes.Foreign_Key_Constraint_Failed,
      detail,
    });
  }
}

export class ConstraintFailedException extends BadRequestException {
  constructor(detail: string) {
    super({
      error: 'A constraint failed on the database',
      errorCode: PrismaResponseCodes.Constraint_Failed,
      detail,
    });
  }
}

export class ValueTooLargeException extends BadRequestException {
  constructor(detail: string) {
    super({
      error: 'The value is too large for the field',
      errorCode: PrismaResponseCodes.Value_Too_Large,
      detail,
    });
  }
}

export class ValueTooLongForColumnException extends BadRequestException {
  constructor(detail: string) {
    super({
      error: 'The provided value for the column is too long',
      errorCode: PrismaResponseCodes.Value_Too_Long_For_Column,
      detail,
    });
  }
}

export class ValidationFailedException extends BadRequestException {
  constructor(detail: string) {
    super({
      error: 'A validation failed',
      errorCode: PrismaResponseCodes.Validation_Failed,
      detail,
    });
  }
}

export class QueryParsingFailedException extends BadRequestException {
  constructor(detail: string) {
    super({
      error: 'Failed to parse the query',
      errorCode: PrismaResponseCodes.Query_Parsing_Failed,
      detail,
    });
  }
}

export class InvalidAccessException extends UnauthorizedException {
  constructor(detail: string) {
    super({
      error: 'Invalid access',
      errorCode: PrismaResponseCodes.Invalid_Access,
      detail,
    });
  }
}

export class RawQueryFailedException extends BadRequestException {
  constructor(detail: string) {
    super({
      error: 'Raw query failed',
      errorCode: PrismaResponseCodes.Raw_Query_Failed,
      detail,
    });
  }
}

export class NullConstraintViolationException extends BadRequestException {
  constructor(detail: string) {
    super({
      error: 'Null constraint violation',
      errorCode: PrismaResponseCodes.Null_Constraint_Violation,
      detail,
    });
  }
}

export class MissingRequiredValueException extends BadRequestException {
  constructor(detail: string) {
    super({
      error: 'Missing a required value',
      errorCode: PrismaResponseCodes.Missing_Required_Value,
      detail,
    });
  }
}

export class MissingRequiredArgumentException extends BadRequestException {
  constructor(detail: string) {
    super({
      error: 'Missing the required argument',
      errorCode: PrismaResponseCodes.Missing_Required_Argument,
      detail,
    });
  }
}

export class RelationViolationException extends BadRequestException {
  constructor(detail: string) {
    super({
      error:
        'The change you are trying to make would violate the required relation',
      errorCode: PrismaResponseCodes.Relation_Violation,
      detail,
    });
  }
}

export class RelatedRecordNotFoundException extends BadRequestException {
  constructor(detail: string) {
    super({
      error: 'A related record could not be found',
      errorCode: PrismaResponseCodes.Related_Record_Not_Found,
      detail,
    });
  }
}

export class QueryInterpretationErrorException extends BadRequestException {
  constructor(detail: string) {
    super({
      error: 'Query interpretation error',
      errorCode: PrismaResponseCodes.Query_Interpretation_Error,
      detail,
    });
  }
}

export class RecordsNotConnectedException extends BadRequestException {
  constructor(detail: string) {
    super({
      error: 'The records for relation are not connected',
      errorCode: PrismaResponseCodes.Records_Not_Connected,
      detail,
    });
  }
}

export class RequiredConnectedRecordsNotFoundException extends BadRequestException {
  constructor(detail: string) {
    super({
      error: 'The required connected records were not found',
      errorCode: PrismaResponseCodes.Required_Connected_Records_Not_Found,
      detail,
    });
  }
}

export class InputErrorException extends BadRequestException {
  constructor(detail: string) {
    super({
      error: 'Input error',
      errorCode: PrismaResponseCodes.Input_Error,
      detail,
    });
  }
}

export class ValueOutOfRangeException extends BadRequestException {
  constructor(detail: string) {
    super({
      error: 'Value out of range for database column',
      errorCode: PrismaResponseCodes.Value_Out_Of_Range,
      detail,
    });
  }
}

export class UnexpectedErrorException extends InternalServerErrorException {
  constructor(detail: string) {
    super({
      error: 'An unexpected error occurred',
      errorCode: PrismaResponseCodes.Unexpected_Error,
      detail,
    });
  }
}
