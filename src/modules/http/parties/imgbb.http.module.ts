import { Module } from '@nestjs/common';
import { envEnums } from 'src/config/enums';
import { HttpService } from '@nestjs/axios';
import {
  OutgoingHttpModule,
  createExternalServiceHttpModule,
} from '../http.module';

export const IMGBB_HTTP_PROVIDER = 'IMGBB_HTTP_PROVIDER';

@Module({
  imports: [
    createExternalServiceHttpModule({
      endpointKey: envEnums.IMGBB_API_BASE_URL, // Ensure this is set in your environment configs
    }),
    OutgoingHttpModule,
  ],
  providers: [{ provide: IMGBB_HTTP_PROVIDER, useExisting: HttpService }],
  exports: [IMGBB_HTTP_PROVIDER],
})
export class ImgBBHttpModule extends OutgoingHttpModule {}
