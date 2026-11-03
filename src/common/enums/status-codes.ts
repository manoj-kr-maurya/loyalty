import { HttpStatus } from '@nestjs/common';

const SuccessStatus = {
  Success: 'Success',
} as const;

const ErrorStatus = {
  Failure: 'Failure',
} as const;

export const CallStatuses = {
  ...SuccessStatus,
  ...ErrorStatus,
};

// Type derived from the combined object
export type CallStatuses = (typeof CallStatuses)[keyof typeof CallStatuses];

// HTTP Status Codes for use in CommonException
export const StatusCodes = {
  BAD_REQUEST: HttpStatus.BAD_REQUEST,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  CONFLICT: HttpStatus.CONFLICT,
  INTERNAL_SERVER_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
  UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  UNPROCESSABLE_ENTITY: HttpStatus.UNPROCESSABLE_ENTITY,
  SERVICE_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  GONE: HttpStatus.GONE,
} as const;

export type StatusCodes = (typeof StatusCodes)[keyof typeof StatusCodes];
