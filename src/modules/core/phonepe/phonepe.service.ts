import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { AxiosResponse } from 'axios';
import {
  PhonepePaymentInitiationRequest,
  PhonepePaymentInitiationResponse,
} from './DTO/phonepe.dto';
import { PHONEPE_HTTP_PROVIDER } from 'src/modules/http/parties/phonepe.http.module';

@Injectable()
export class PhonepeService {
  constructor(
    @Inject(PHONEPE_HTTP_PROVIDER)
    private readonly phonepeHttpService: HttpService,
  ) {}

  makePayment(
    data: PhonepePaymentInitiationRequest,
  ): Observable<AxiosResponse<PhonepePaymentInitiationResponse>> {
    const url = '/apis/pg-sandbox/pg/v1/pay';
    const headers = {
      accept: 'text/plain',
      'Content-Type': 'application/json',
    };

    return this.phonepeHttpService
      .post(url, data, { headers })
      .pipe(map((response) => response.data));
  }
}
