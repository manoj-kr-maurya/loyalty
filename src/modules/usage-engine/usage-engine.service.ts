import { Injectable } from '@nestjs/common';

@Injectable()
export class UsageEngineService {
  validateUsage(context: any): { valid: boolean; reasons?: string[] } {
    return {
      valid: true,
      reasons: [],
    };
  }
}
