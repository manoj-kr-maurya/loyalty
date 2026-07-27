import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  UniqueConstraintViolationException,
  RecordNotFoundException,
  ForeignKeyConstraintFailedException,
  ConstraintFailedException,
  ValueTooLargeException,
  ValueTooLongForColumnException,
  ValidationFailedException,
  QueryParsingFailedException,
  InvalidAccessException,
  RawQueryFailedException,
  NullConstraintViolationException,
  MissingRequiredValueException,
  MissingRequiredArgumentException,
  RelationViolationException,
  RelatedRecordNotFoundException,
  QueryInterpretationErrorException,
  RecordsNotConnectedException,
  RequiredConnectedRecordsNotFoundException,
  InputErrorException,
  ValueOutOfRangeException,
  UnexpectedErrorException,
} from './prisma-client-exceptions';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    console.error(exception.message);
    const message = exception.message.replace(/\n/g, '');

    let customException;

    switch (exception.code) {
      case 'P2002':
        customException = new UniqueConstraintViolationException(message);
        break;
      case 'P2025':
        customException = new RecordNotFoundException(message);
        break;
      case 'P2003':
        customException = new ForeignKeyConstraintFailedException(message);
        break;
      case 'P2004':
        customException = new ConstraintFailedException(message);
        break;
      case 'P2005':
        customException = new ValueTooLargeException(message);
        break;
      case 'P2006':
        customException = new ValueTooLongForColumnException(message);
        break;
      case 'P2007':
        customException = new ValidationFailedException(message);
        break;
      case 'P2008':
        customException = new QueryParsingFailedException(message);
        break;
      case 'P2009':
        customException = new InvalidAccessException(message);
        break;
      case 'P2010':
        customException = new RawQueryFailedException(message);
        break;
      case 'P2011':
        customException = new NullConstraintViolationException(message);
        break;
      case 'P2012':
        customException = new MissingRequiredValueException(message);
        break;
      case 'P2013':
        customException = new MissingRequiredArgumentException(message);
        break;
      case 'P2014':
        customException = new RelationViolationException(message);
        break;
      case 'P2015':
        customException = new RelatedRecordNotFoundException(message);
        break;
      case 'P2016':
        customException = new QueryInterpretationErrorException(message);
        break;
      case 'P2017':
        customException = new RecordsNotConnectedException(message);
        break;
      case 'P2018':
        customException = new RequiredConnectedRecordsNotFoundException(
          message,
        );
        break;
      case 'P2019':
        customException = new InputErrorException(message);
        break;
      case 'P2020':
        customException = new ValueOutOfRangeException(message);
        break;
      default:
        customException = new UnexpectedErrorException(message);
        break;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    // Extract error details from the custom exception
    const { response: errorResponse } = customException;

    response.status(errorResponse.statusCode || 500).json({
      error: errorResponse.error,
      errorCode: errorResponse.errorCode,
      detail: errorResponse.detail,
    });
  }
}
