import { Module } from '@nestjs/common';
import { envEnums } from 'src/config/enums';
import { HttpService } from '@nestjs/axios';
import {
  OutgoingHttpModule,
  createExternalServiceHttpModule,
} from '../http.module';

export const FACTOR2_HTTP_PROVIDER = 'FACTOR2_HTTP_PROVIDER';

@Module({
  imports: [
    createExternalServiceHttpModule({
      endpointKey: envEnums.FACTOR2_API_BASE_URL,
    }),
    OutgoingHttpModule,
  ],
  providers: [{ provide: FACTOR2_HTTP_PROVIDER, useExisting: HttpService }],
  exports: [FACTOR2_HTTP_PROVIDER],
})
export class Factor2HttpModule extends OutgoingHttpModule {}
