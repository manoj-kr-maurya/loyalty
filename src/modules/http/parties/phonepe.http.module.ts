import { Module } from '@nestjs/common';
import { envEnums } from 'src/config/enums';
import { HttpService } from '@nestjs/axios';
import {
  OutgoingHttpModule,
  createExternalServiceHttpModule,
} from '../http.module';

export const PHONEPE_HTTP_PROVIDER = 'PHONEPE_HTTP_PROVIDER';

@Module({
  imports: [
    createExternalServiceHttpModule({ endpointKey: envEnums.PHONEPE_BASE_URL }),
  ],
  providers: [{ provide: PHONEPE_HTTP_PROVIDER, useExisting: HttpService }],
  exports: [],
})
export class PhonepeHttpModule extends OutgoingHttpModule {}
