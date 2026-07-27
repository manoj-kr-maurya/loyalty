export interface Factor2ApiResponse {
  Status: Factor2ApiResponseStatus;
  Details: string;
}

enum Factor2ApiResponseStatus {
  Success = 'Success',
  Error = 'Error',
}

export interface Factor2SendCustomGeneratedOtpRequest {
  phoneNumberWithCountryCodeAndPlus: string;
  otp: string;
  templateName?: string;
}

// export interface Factor2SendTransactionSmsRequest {
//   phoneNumber: string;
//   templateName: string;
//   from: string;
//   vars?: [string];
// }

type Length<T extends any[]> = T['length'];

interface BaseFactor2SendTransactionSmsRequest {
  phoneNumber: string;
  templateName: string;
  from: string;
}

export interface Factor2SendTransactionSmsRequestWithVars<V extends string[]>
  extends BaseFactor2SendTransactionSmsRequest {
  vars: V;
  varsLength: Length<V>;
}

export interface Factor2SendTransactionSmsRequestWithoutVars
  extends BaseFactor2SendTransactionSmsRequest {
  vars?: undefined;
  varsLength: 0;
}

export type Factor2SendTransactionSmsRequest<
  V extends string[] | undefined = undefined,
> = V extends undefined
  ? Factor2SendTransactionSmsRequestWithoutVars
  : Factor2SendTransactionSmsRequestWithVars<V>;
