import { ApiProperty } from '@nestjs/swagger';

export class PromotionDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  rewardType: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  validFrom: string;

  @ApiProperty()
  validTo: string;

  @ApiProperty()
  eligibilityCriteria: any;
}
