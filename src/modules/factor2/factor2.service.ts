import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { AxiosResponse } from 'axios';
import {
  Factor2SendCustomGeneratedOtpRequest,
  Factor2ApiResponse,
  Factor2SendTransactionSmsRequestWithVars,
  Factor2SendTransactionSmsRequest,
  Factor2SendTransactionSmsRequestWithoutVars,
} from './DTO/factor2.dto';
import { ConfigService } from '@nestjs/config';
import { envEnums } from 'src/config/enums';
import { FACTOR2_HTTP_PROVIDER } from 'src/modules/http/parties/factor2.http.module';

@Injectable()
export class Factor2Service {
  private readonly logger = new Logger(Factor2Service.name);

  constructor(
    @Inject(FACTOR2_HTTP_PROVIDER)
    private readonly factor2HttpService: HttpService,
    private readonly config: ConfigService,
  ) {}

  async sendCustomGeneratedOtp(
    data: Factor2SendCustomGeneratedOtpRequest,
  ): Promise<Factor2ApiResponse> {
    const apikey = this.config.get(envEnums.FACTOR2_API_KEY);
    const url = `/V1/${apikey}/SMS/${data.phoneNumberWithCountryCodeAndPlus}/${data.otp}/${data.templateName}`;
    try {
      const response: AxiosResponse<Factor2ApiResponse> =
        await this.factor2HttpService.get(url).toPromise();
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  sendTransactionSms(
    data: Factor2SendTransactionSmsRequestWithoutVars,
  ): Promise<Factor2ApiResponse>;
  sendTransactionSms<V extends string[]>(
    data: Factor2SendTransactionSmsRequestWithVars<V>,
  ): Promise<Factor2ApiResponse>;
  async sendTransactionSms<V extends string[]>(
    data: Factor2SendTransactionSmsRequest<V>,
  ): Promise<Factor2ApiResponse> {
    const apikey = this.config.get(envEnums.FACTOR2_API_KEY);
    const { phoneNumber, from, templateName, vars } = data;

    // Replace spaces with '+' in the templateName
    const formattedTemplateName = templateName.replace(/\s/g, '+');

    // Construct the URL with the query parameters
    let url = `/R1/?module=TRANS_SMS&apikey=${apikey}&to=${phoneNumber}&from=${from}&templatename=${formattedTemplateName}`;

    // Append vars to the URL
    if (vars) {
      vars.forEach((variable, index) => {
        url += `&var${index + 1}=${encodeURIComponent(variable)}`;
      });
    }

    try {
      const response: AxiosResponse<Factor2ApiResponse> =
        await this.factor2HttpService.get(url).toPromise();
      return response.data;
    } catch (error) {
      throw new Error(`Failed to send transaction SMS: ${error.message}`);
    }
  }

  // i dont know why i thought the above thing was a good idea.
}
