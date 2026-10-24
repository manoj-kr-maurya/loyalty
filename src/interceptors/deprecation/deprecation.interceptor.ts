import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import {
  DEPRECATED_API_KEY,
  DeprecatedApiOptions,
} from './deprecated-api.decorator';

@Injectable()
export class DeprecationInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') return next.handle();

    const options = this.reflector.getAllAndOverride<DeprecatedApiOptions>(
      DEPRECATED_API_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) return next.handle();

    const response = context.switchToHttp().getResponse();

    response.setHeader('Deprecation', 'true');

    if (options.sunset) {
      const sunset = new Date(options.sunset);
      if (!Number.isNaN(sunset.getTime())) {
        response.setHeader('Sunset', sunset.toUTCString());
      }
    }

    if (options.replacement) {
      response.setHeader(
        'Link',
        `<${options.replacement}>; rel="successor-version"`,
      );
    }

    return next.handle();
  }
}
