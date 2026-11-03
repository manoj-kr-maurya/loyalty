import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { DeprecationInterceptor } from './deprecation.interceptor';

const executionContext = (response: any) =>
  ({
    getType: () => 'http',
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({ getResponse: () => response }),
  } as any);

const next = { handle: jest.fn().mockReturnValue(of('ok')) } as any;

describe('DeprecationInterceptor', () => {
  let reflector: Reflector;
  let interceptor: DeprecationInterceptor;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as any;
    interceptor = new DeprecationInterceptor(reflector);
    next.handle.mockClear();
  });

  it('emits deprecation headers when metadata is present', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue({
      sunset: '2027-06-30T00:00:00Z',
      replacement: '/engines/loyalty',
    });
    const response = { setHeader: jest.fn() };

    interceptor.intercept(executionContext(response), next);

    expect(response.setHeader).toHaveBeenCalledWith('Deprecation', 'true');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Sunset',
      'Wed, 30 Jun 2027 00:00:00 GMT',
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Link',
      '</engines/loyalty>; rel="successor-version"',
    );
  });

  it('does nothing when no metadata is present', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    const response = { setHeader: jest.fn() };

    interceptor.intercept(executionContext(response), next);

    expect(response.setHeader).not.toHaveBeenCalled();
    expect(next.handle).toHaveBeenCalled();
  });
});
