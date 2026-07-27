import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { envEnums } from 'src/config/enums';

@Injectable()
export class IncomingReqResLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IncomingReqResLoggingInterceptor.name);
  private readonly ignoredRoutes: string[] = ['/metrics'];

  constructor(private configService: ConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    if (this.shouldIgnoreRoute(request.path)) {
      return next.handle();
    }

    const requestId = uuidv4();
    request['requestId'] = requestId;
    const requestStartTime = Date.now();
    const environment = this.configService.get<string>(envEnums.ENVIRONMENT);
    const { method, originalUrl, ip, headers, body } = request;

    // Log incoming request
    this.logger.log({
      requestId,
      event: 'INCOMING_REQUEST',
      method,
      url: originalUrl,
      environment,
      timestamp: new Date().toISOString(),
      ip,
      headers: this.sanitizeHeaders(headers),
      body,
    });

    return next.handle().pipe(
      tap((data) => {
        this.logger.log({
          requestId,
          event: 'OUTGOING_RESPONSE',
          statusCode: response.statusCode,
          responseTime: `${Date.now() - requestStartTime}ms`,
          environment,
          timestamp: new Date().toISOString(),
          responseBody: this.parseResponseBody(data),
          responseHeaders: this.sanitizeHeaders(response.getHeaders()),
        });
      }),
      catchError((error) => {
        this.logger.error({
          requestId,
          event: 'OUTGOING_ERROR_RESPONSE',
          statusCode: response.statusCode || 500,
          responseTime: `${Date.now() - requestStartTime}ms`,
          environment,
          timestamp: new Date().toISOString(),
          errorMessage: error.message,
          stackTrace: error.stack,
          errorCode: error.errorCode,
        });
        throw error;
      }),
    );
  }

  private shouldIgnoreRoute(path: string): boolean {
    return this.ignoredRoutes.some((route) => path.startsWith(route));
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    ['authorization', 'cookie'].forEach((header) => {
      if (sanitized[header]) sanitized[header] = '[REDACTED]';
    });
    return sanitized;
  }

  private parseResponseBody(responseBody: any): any {
    if (typeof responseBody === 'string') {
      try {
        return JSON.parse(responseBody);
      } catch {
        return responseBody;
      }
    }
    return responseBody;
  }
}
