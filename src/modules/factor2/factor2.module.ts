import { Module } from '@nestjs/common';
import { Factor2Service } from './factor2.service';
import { ConfigService } from '@nestjs/config';
import { Factor2HttpModule } from 'src/modules/http/parties/factor2.http.module';

@Module({
  imports: [Factor2HttpModule],
  providers: [Factor2Service, ConfigService],
  exports: [Factor2Service],
})
export class Factor2Module {}
