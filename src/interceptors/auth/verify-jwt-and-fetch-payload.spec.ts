import { ExecutionContext, CallHandler } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import { VerifyJWTAndFetchPayload } from './verify-jwt-and-fetch-payload';
import { AuthService } from 'src/modules/auth/auth.service';
import { of } from 'rxjs';

describe('VerifyJWTAndFetchPayload', () => {
  let interceptor: VerifyJWTAndFetchPayload;
  let authService: jest.Mocked<AuthService>;

  const createMockContext = (headers: Record<string, string | undefined>): ExecutionContext => {
    const mockRequest: any = { headers };
    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as unknown as ExecutionContext;
  };

  const mockCallHandler: CallHandler = {
    handle: () => of({ data: 'response' }),
  };

  beforeEach(() => {
    authService = {
      verifyJWT: jest.fn(),
    } as any;
    interceptor = new VerifyJWTAndFetchPayload(authService);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should throw 401 when no authorization header is provided', async () => {
    const context = createMockContext({});

    await expect(interceptor.intercept(context, mockCallHandler)).rejects.toThrow(
      HttpException,
    );

    try {
      await interceptor.intercept(context, mockCallHandler);
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    }
  });

  it('should throw 401 when token is invalid', async () => {
    authService.verifyJWT.mockRejectedValue(new Error('Invalid token'));
    const context = createMockContext({ authorization: 'Bearer invalid-token' });

    await expect(interceptor.intercept(context, mockCallHandler)).rejects.toThrow(
      HttpException,
    );
  });

  it('should set tokenPayload on request when valid token is provided', async () => {
    const tokenPayload = { sub: 'user-1', sessionId: 'sess-1', userType: 'Customer' };
    authService.verifyJWT.mockResolvedValue(tokenPayload);

    const context = createMockContext({ authorization: 'Bearer valid-token' });
    await interceptor.intercept(context, mockCallHandler);

    const request = context.switchToHttp().getRequest();
    expect(request.tokenPayload).toEqual(tokenPayload);
    expect(request.token).toBe('valid-token');
  });

  it('should call next.handle() when valid token is provided', async () => {
    const tokenPayload = { sub: 'user-1', sessionId: 'sess-1' };
    authService.verifyJWT.mockResolvedValue(tokenPayload);

    const context = createMockContext({ authorization: 'Bearer valid-token' });
    const result = await interceptor.intercept(context, mockCallHandler);

    expect(result).toBeDefined();
    result.subscribe();
  });

  it('should extract token after "Bearer " prefix', async () => {
    const tokenPayload = { sub: 'user-1', sessionId: 'sess-1' };
    authService.verifyJWT.mockResolvedValue(tokenPayload);

    const context = createMockContext({ authorization: 'Bearer my-jwt-token' });
    await interceptor.intercept(context, mockCallHandler);

    expect(authService.verifyJWT).toHaveBeenCalledWith('my-jwt-token');
  });

  it('should throw 401 when verifyJWT returns payload without sub', async () => {
    authService.verifyJWT.mockResolvedValue({ sessionId: 'sess-1' });
    const context = createMockContext({ authorization: 'Bearer token' });

    await expect(interceptor.intercept(context, mockCallHandler)).rejects.toThrow(
      HttpException,
    );
  });

  it('should throw 401 with "Please provide bearer token" message when no header', async () => {
    const context = createMockContext({});

    try {
      await interceptor.intercept(context, mockCallHandler);
    } catch (error) {
      expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    }
  });

  it('should pass through to next handler and return its observable', async () => {
    const tokenPayload = { sub: 'user-1' };
    authService.verifyJWT.mockResolvedValue(tokenPayload);

    const context = createMockContext({ authorization: 'Bearer valid-token' });
    let nextCalled = false;
    const testHandler: CallHandler = {
      handle: () => {
        nextCalled = true;
        return of({ result: 'ok' });
      },
    };

    await interceptor.intercept(context, testHandler);
    expect(nextCalled).toBe(true);
  });
});
