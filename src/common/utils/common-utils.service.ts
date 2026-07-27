import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid'; // Import v4 function and rename it to uuidv4 for clarity
import { randomBytes } from 'crypto';

@Injectable()
export class CommonUtilsService {
  validateOtp(dbOtp: string, userOtp: string): boolean {
    if (dbOtp != userOtp) {
      return false;
    }
    return true;
  }
  generateOtp(length: number): string {
    const chars = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += chars[Math.floor(Math.random() * chars.length)];
    }
    return otp;
  }

  generateJobName(baseJobName: string, uniqueId: string): string {
    return `${baseJobName}_${uniqueId}`;
  }
  generateNewUniqueTransactionId(initiater: string): string {
    if (initiater === 'organization') {
      return `org_txn_${uuidv4()}`; // Use the uuidv4 function to generate a new UUID
    } else if (initiater === 'customer') {
      return `cus_org_txn_${uuidv4()}`; // Use the uuidv4 function to generate a new UUID
    }
  }
  generateNewUniqueGatewayId(): string {
    return `txn_gateway_${uuidv4()}`; // Use the uuidv4 function to generate a new UUID
  }

  getTimeFromCampaignExpiryEnum(earningExpiresIn: number): Date {
    const currentTime = Date.now();
    const timeToAdd: number = earningExpiresIn * 24 * 60 * 60 * 1000;

    return new Date(currentTime + timeToAdd);
  }

  generateSessionId(): string {
    // Generate a random 16-byte buffer and convert it to a hexadecimal string
    const randomPart = randomBytes(16).toString('hex');

    // Optionally, you can include a timestamp for additional uniqueness
    const timestampPart = Date.now().toString(36);

    // Combine the parts to create the session ID
    const sessionId = `${timestampPart}-${randomPart}`;

    return sessionId;
  }
}
