import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { OrganizationAuthContext } from '../api-key.service';

export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): OrganizationAuthContext => {
    return context.switchToHttp().getRequest().organizationAuth;
  },
);
