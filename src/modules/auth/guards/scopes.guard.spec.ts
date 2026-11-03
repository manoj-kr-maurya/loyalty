import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ScopesGuard } from './scopes.guard';

const errorPayload = (callback: () => unknown) => {
  try {
    callback();
  } catch (error) {
    return (error as any).getResponse();
  }
  throw new Error('Expected callback to throw');
};

const executionContext = (organizationAuth?: any) => {
  const request: any = { organizationAuth };
  return {
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
};

describe('ScopesGuard', () => {
  let reflector: Reflector;
  let guard: ScopesGuard;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;
    guard = new ScopesGuard(reflector);
  });

  it('allows requests with no required scopes', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([]);

    expect(guard.canActivate(executionContext())).toBe(true);
  });

  it('allows platform keys through', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      'loyalty:write',
    ]);

    expect(
      guard.canActivate(executionContext({ type: 'platform', scopes: ['*'] })),
    ).toBe(true);
  });

  it('allows organization keys that hold every required scope', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      'loyalty:read',
    ]);

    expect(
      guard.canActivate(
        executionContext({
          type: 'organization',
          organizationId: 'org-1',
          scopes: ['loyalty:read', 'loyalty:write'],
        }),
      ),
    ).toBe(true);
  });

  it('rejects organization keys that miss a scope', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      'loyalty:write',
    ]);

    expect(
      errorPayload(() =>
        guard.canActivate(
          executionContext({
            type: 'organization',
            organizationId: 'org-1',
            scopes: ['loyalty:read'],
          }),
        ),
      ),
    ).toMatchObject({
      error: 'API key is missing required scope(s): loyalty:write',
    });
  });

  it('rejects requests without an auth context', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      'loyalty:read',
    ]);

    expect(() => guard.canActivate(executionContext())).toThrow(
      UnauthorizedException,
    );
  });
});
