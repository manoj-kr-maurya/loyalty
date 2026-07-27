import { UserTypes } from '../../../../common/enums/user-types';

export interface JwtTokenPayload {
  sub: string;
  iat?: number;
  exp?: number;
  tokenType: UserTypes;
}

export interface RequestWithJWTTokenPayloadAndToken extends Request {
  tokenPayload: JwtTokenPayload;
  token: string;
}
