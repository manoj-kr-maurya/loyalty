import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import to from 'await-to-js';
import { Observable } from 'rxjs';
import { AuthService } from 'src/modules/auth/auth.service';

@Injectable()
export class VerifyJWTAndFetchPayload implements NestInterceptor {
  constructor(private readonly authService: AuthService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const { authorization } = request.headers;

    if (!authorization) {
      throw new HttpException(
        'Please provide bearer token',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const token = authorization.split(' ')[1];
    const [error, tokenPayload] = await to(this.authService.verifyJWT(token));

    if (error || !tokenPayload.sub) {
      throw new HttpException('Bearer token invalid', HttpStatus.UNAUTHORIZED);
    }

    request.tokenPayload = tokenPayload;
    request.token = token;

    return next.handle();
  }
}
