import { Module } from '@nestjs/common';
import { PhonepeService } from './phonepe.service';
import { PhonepeHttpModule } from 'src/modules/http/parties/phonepe.http.module';

@Module({
  imports: [PhonepeHttpModule],
  providers: [PhonepeService],
})
export class PhonepeModule {}
