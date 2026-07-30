import { ApiProperty } from '@nestjs/swagger';

export class ProgramFormDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  rewardCurrency: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  budgetEnabled: boolean;

  @ApiProperty()
  expiryNotification: boolean;

  @ApiProperty()
  priority: number;

  @ApiProperty()
  programType: string;

  @ApiProperty()
  business: string;

  @ApiProperty()
  category: string;
}
