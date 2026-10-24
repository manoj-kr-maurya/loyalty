import { MailerService } from '@nestjs-modules/mailer';
import { CommonException } from 'src/common/exceptions/common.exception';
import { StatusCodes } from 'src/common/enums/status-codes';
import { Injectable, Logger } from '@nestjs/common';
import { GetInTouch } from './DTO/mail-and-sms.dto';
import { ConfigService } from '@nestjs/config';
import { Environments, envEnums } from 'src/config/enums';
import { Factor2Service } from 'src/modules/factor2/factor2.service';
import { Factor2SendTransactionSmsRequestWithVars } from 'src/modules/factor2/DTO/factor2.dto';
import { UserTypes } from 'src/common/enums/user-types';

@Injectable()
export class MailAndSmsService {
  private logger = new Logger('Notification Service');

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    private readonly factor2Service: Factor2Service,
  ) {}

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async getInTouchProducer(body: GetInTouch) {
    const name = this.escapeHtml(body.metaData.name);
    const email = this.escapeHtml(body.metaData.email);
    const message = this.escapeHtml(body.metaData.message);
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
        <p>Their name is <strong>${name}</strong>.</p>
        <p>Their message is <strong>${message}</strong>.</p>

        <p>Their email is <strong>${email}</strong>.</p>

      </body>

      </html>
      `;
    try {
      await this.getInTouch({ html, subject });
    } catch (error) {
      this.logger.error(
        `Could not send get-in-touch email: ${(error as Error).message}`,
      );
      throw new CommonException(
        'Could not send contact message right now',
        StatusCodes.SERVICE_UNAVAILABLE,
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
