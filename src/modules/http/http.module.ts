import {
  HttpModule as BaseHttpModule,
  HttpModuleOptions,
  HttpService,
} from '@nestjs/axios';
import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ExternalServiceBaseUrlsVariables } from 'src/config/types';
import { v4 as uuidv4 } from 'uuid';

@Module({
  imports: [BaseHttpModule, ConfigModule],
  exports: [BaseHttpModule],
})
export class OutgoingHttpModule implements OnModuleInit {
  private readonly logger = new Logger(OutgoingHttpModule.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private logRequest(
    requestId: string,
    environment: string,
    method: string,
    url: string,
    headers: any,
    body: any,
  ): void {
    const logData = {
      event: 'OUTGOING_REQUEST',
      requestId,
      timestamp: new Date().toISOString(),
      method,
      url,
      environment,
      headers: this.sanitizeHeaders(headers),
      body: this.truncateBody(body),
    };
    this.logger.log(logData);
  }

  private logResponse(
    requestId: string,
    environment: string,
    method: string,
    url: string,
    statusCode: number,
    responseTime: number,
    responseBody: any,
  ): void {
    const logData = {
      event: 'INCOMING_RESPONSE',
      requestId,
      timestamp: new Date().toISOString(),
      method,
      url,
      statusCode,
      responseTime: `${responseTime}ms`,
      responseBody: this.truncateBody(responseBody),
      environment,
    };
    this.logger.log(logData);
  }

  private logErrorResponse(
    requestId: string,
    environment: string,
    method: string,
    url: string,
    error: any,
    responseTime: number,
  ): void {
    const logData = {
      event: 'INCOMING_ERROR_RESPONSE',
      requestId,
      timestamp: new Date().toISOString(),
      method,
      url,
      errorMessage: error.message,
      stackTrace: this.truncateStackTrace(error.stack),
      responseTime: `${responseTime}ms`,
      environment,
    };
    this.logger.error(logData);
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    sensitiveHeaders.forEach((header) => {
      if (sanitized[header]) sanitized[header] = '[REDACTED]';
    });
    return sanitized;
  }

  private truncateBody(body: any, maxLength = 1000): string {
    if (body === undefined || body === null) return 'No body';
    const stringBody = typeof body === 'string' ? body : JSON.stringify(body);
    if (stringBody.length <= maxLength) return stringBody;
    return stringBody.substring(0, maxLength) + '... (truncated)';
  }

  private truncateStackTrace(stack: string, maxLines = 3): string {
    if (!stack) return '';
    const lines = stack.split('\n');
    return (
      lines.slice(0, maxLines).join('\n') +
      (lines.length > maxLines ? '\n... (truncated)' : '')
    );
  }

  public onModuleInit(): any {
    const axios = this.httpService.axiosRef;
    const environment = this.configService.get('ENVIRONMENT');

    axios.interceptors.request.use((config) => {
      const requestId = uuidv4();
      config['metadata'] = {
        startDate: new Date(),
        requestId,
      };

      this.logRequest(
        requestId,
        environment,
        config.method.toUpperCase(),
        `${config.baseURL}${config.url}`,
        config.headers,
        config.data,
      );
      return config;
    });

    axios.interceptors.response.use(
      (response) => {
        const { config } = response;
        config['metadata'].endDate = new Date();
        const duration =
          config['metadata'].endDate.getTime() -
          config['metadata'].startDate.getTime();

        this.logResponse(
          config['metadata'].requestId,
          environment,
          config.method.toUpperCase(),
          `${config.baseURL}${config.url}`,
          response.status,
          duration,
          response.data,
        );
        return response;
      },
      (error) => {
        const { config } = error;
        if (config) {
          config['metadata'].endDate = new Date();
          const duration =
            config['metadata'].endDate.getTime() -
            config['metadata'].startDate.getTime();

          this.logErrorResponse(
            config['metadata'].requestId,
            environment,
            config.method.toUpperCase(),
            `${config.baseURL}${config.url}`,
            {
              message: error.message,
              response: error.response
                ? {
                    data: error.response.data,
                    status: error.response.status,
                    statusText: error.response.statusText,
                  }
                : null,
            },
            duration,
          );
        } else {
          this.logErrorResponse(
            'unknown',
            environment,
            'UNKNOWN',
            'UNKNOWN',
            error.message,
            0,
          );
        }
        return Promise.reject(error);
      },
    );
  }
}

export interface ExternalServiceHttpModuleOptions extends HttpModuleOptions {
  readonly extras: Readonly<{ isExternalService: true }>;
}

export const createExternalServiceHttpModule = ({
  endpointKey,
}: Readonly<{ endpointKey: keyof ExternalServiceBaseUrlsVariables }>) => {
  return BaseHttpModule.registerAsync({
    imports: [ConfigModule],
    useFactory: async (
      configService: ConfigService,
    ): Promise<ExternalServiceHttpModuleOptions> => ({
      baseURL: configService.get(endpointKey as string),
      responseType: 'json',
      extras: { isExternalService: true },
    }),
    inject: [ConfigService],
  });
};
