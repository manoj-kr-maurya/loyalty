import {
  Controller,
  Get,
  Logger,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from 'src/config/types';
import { envEnums } from 'src/config/enums';

@Controller('')
export class AppController {
  private readonly logger = new Logger(AppController.name);
  private readonly lastRestartedOrDeployedTimestamp: string;
  private readonly crashToken: string;

  constructor(private readonly configService: ConfigService) {
    this.lastRestartedOrDeployedTimestamp = this.getDeploymentTimestamp();
    this.crashToken = this.configService.get(envEnums.REDIS_PASSWORD);
  }

  private getDeploymentTimestamp(): string {
    return this.formatToIST(new Date());
  }

  private formatToIST(date: Date): string {
    return date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  }

  @Get('/')
  async serviceCheck() {
    this.logger.log('Service Check in App Controller');

    return {
      environment: this.configService.get<EnvironmentVariables>(
        envEnums.ENVIRONMENT,
      ),
      lastRestartedOrDeployedTimestamp: this.lastRestartedOrDeployedTimestamp,
    };
  }

  @Get('/restart')
  async restartServer(@Headers('lsb-crash-token') crashToken: string) {
    this.logger.log('Restart endpoint called');

    if (!crashToken || crashToken !== this.crashToken) {
      throw new UnauthorizedException('Invalid crash token');
    }

    this.logger.warn('Server restart triggered via endpoint');

    // Using process.exit() to crash the server, which PM2 will then restart
    process.exit(1);
  }
}
