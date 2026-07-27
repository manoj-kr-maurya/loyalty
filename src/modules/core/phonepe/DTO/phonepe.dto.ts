export interface PhonepePaymentInitiationResponse {
  success: boolean;
  code: string;
  message: string;
  data: PaymentData;
}

interface PaymentData {
  merchantId: string;
  merchantTransactionId: string;
  instrumentResponse: InstrumentResponse;
}

interface InstrumentResponse {
  type: string;
  redirectInfo: RedirectInfo;
}

interface RedirectInfo {
  url: string;
  method: string;
}

export interface PhonepePaymentInitiationRequest {
  merchantId: string;
  merchantTransactionId: string;
  merchantUserId: string;
  name: string;
  amount: number;
  redirectUrl: string;
  redirectMode: 'GET' | 'POST'; // Assuming these are the only two valid options
  mobileNumber: string;
  paymentInstrument: PaymentInstrument;
}

interface PaymentInstrument {
  type: 'PAY_PAGE'; // Assuming this is the only valid option for now, adjust as necessary
}
