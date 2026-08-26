import { ExecutionContext, HttpException } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(() => {
    guard = new RateLimitGuard(mockCacheService as any);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow request when under rate limit', async () => {
    mockCacheService.get.mockResolvedValue(0);
    mockCacheService.set.mockResolvedValue(undefined);

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          ip: '127.0.0.1',
          route: { path: '/test' },
          headers: {},
        }),
      }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should reject request when rate limit exceeded', async () => {
    mockCacheService.get.mockResolvedValue(30);

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          ip: '127.0.0.1',
          route: { path: '/test' },
          headers: {},
        }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
  });

  it('should handle forwarded IP header', async () => {
    mockCacheService.get.mockResolvedValue(0);
    mockCacheService.set.mockResolvedValue(undefined);

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          ip: '127.0.0.1',
          route: { path: '/test' },
          headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2' },
        }),
      }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(mockCacheService.set).toHaveBeenCalledWith(
      'rate-limit:/test:10.0.0.1',
      1,
      60000,
    );
  });
});
