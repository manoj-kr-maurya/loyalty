import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, Logger } from '@nestjs/common';
import { GetInTouch } from './DTO/mail-and-sms.dto';
import { ConfigService } from '@nestjs/config';
import { Environments, envEnums } from 'src/config/enums';
import { Factor2Service } from 'src/modules/core/factor2/factor2.service';
import { Factor2SendTransactionSmsRequestWithVars } from 'src/modules/core/factor2/DTO/factor2.dto';
import { UserTypes } from 'src/common/enums/user-types';

@Injectable()
export class MailAndSmsService {
  private logger = new Logger('Notification Service');

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    private readonly factor2Service: Factor2Service,
  ) {}

  getInTouchProducer(body: GetInTouch) {
    const subject = 'Somebody is interested...';
    const html = `
      <!DOCTYPE html>
      <html>

      <head>
        <meta charset="UTF-8">
        <title>We have only 1 mail domain. ;-;</title>
      </head>

      <body>
        <h1>Somebody wants to contact you</h1>
        <p>Their name is <strong>${body.metaData.name}</strong>.</p>
        <p>Their message is <strong>${body.metaData.message}</strong>.</p>

        <p>Their email is <strong>${body.metaData.email}</strong>.</p>

      </body>

      </html>
      `;
    try {
      this.getInTouch({ html, subject });
    } catch {
      console.error(
        `Could not send get in touch email for this html: ${html} and this subject: ${subject}`,
      );
    }
  }
  getInTouch({ html, subject }) {
    return this.mailerService.sendMail({
      from: this.configService.get(envEnums.SENDER_MAIL),
      to: this.configService.get(envEnums.SENDER_MAIL),
      subject,
      html,
    });
  }

  sendOtpToMail(to: string, otp: string) {
    return this.mailerService.sendMail({
      from: process.env.SENDER_EMAIl,
      to,
      subject: 'OTP for jas-loyalty-engine-micro',
      html: `
      <!DOCTYPE html>
      <html>

      <head>
        <meta charset="UTF-8">
        <title>OTP to continue</title>
      </head>

      <body>
        <p>Your OTP is <strong>${otp}</strong>.</p>
        <p>It is valid for 10 minutes.</p>
      </body>

      </html>
      `,
    });
  }

  async sendOtpToPhone(
    userType: UserTypes,
    countryCode: string,
    phoneNumber: string,
    otp: string,
  ) {
    if (
      this.configService.get(envEnums.ENVIRONMENT) !== Environments.local &&
      this.configService.get(envEnums.ENVIRONMENT) !== Environments.dev &&
      this.configService.get(envEnums.ENVIRONMENT) !== Environments.stage
    ) {
      const templateName = 'Organization Otp'; // todo: find from db.
      const from = 'LSBONE'; // todo: find from db.

      const vars: [typeof otp] = [otp]; // Explicitly type as a tuple
      const data: Factor2SendTransactionSmsRequestWithVars<typeof vars> = {
        templateName,
        phoneNumber,
        from,
        vars,
        varsLength: 1,
      };
      await this.factor2Service.sendTransactionSms(data);

      // const data: Factor2SendCustomGeneratedOtpRequest = {
      //   phoneNumberWithCountryCodeAndPlus: `+${countryCode}${phoneNumber}`,
      //   otp,
      //   templateName,
      // };
      // await this.factor2Service.sendCustomGeneratedOtp(data);
    }
  }
}
