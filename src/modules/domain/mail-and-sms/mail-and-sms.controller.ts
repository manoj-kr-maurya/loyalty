import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MailAndSmsService } from './mail-and-sms.service';
import { GetInTouch } from './DTO/mail-and-sms.dto';

@ApiTags('Mail and SMS')
@Controller('mail-and-sms')
export class MailAndSmsController {
  constructor(private readonly mailAndSmsService: MailAndSmsService) {}

  @Post(`/get-in-touch`)
  getInTouch(@Body() body: GetInTouch) {
    return this.mailAndSmsService.getInTouchProducer(body);
  }
}
