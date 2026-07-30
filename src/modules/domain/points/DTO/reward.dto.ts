import { ApiProperty } from '@nestjs/swagger';

export class RewardCalculationDto {
  @ApiProperty()
  customer: any;

  @ApiProperty()
  cart: any;

  @ApiProperty()
  payment: any;

  @ApiProperty()
  merchant: any;

  @ApiProperty()
  channel: any;

  @ApiProperty()
  location: any;
}

export class BlockRewardDto {
  @ApiProperty()
  customer: any;

  @ApiProperty()
  cart: any;

  @ApiProperty()
  budget: number;
}

export class AwardRewardDto {
  @ApiProperty()
  blockId: string;

  @ApiProperty()
  payment: any;

  @ApiProperty()
  budget: number;
}

export class ReverseRewardDto {
  @ApiProperty()
  referenceId: string;

  @ApiProperty()
  reason: string;
}

export class ExpireRewardDto {
  @ApiProperty()
  programId?: string;

  @ApiProperty()
  cutoffDate: string;
}
