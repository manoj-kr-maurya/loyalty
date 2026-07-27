import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateOrEditOrganizationCampaignForm {
  @ApiPropertyOptional({
    description: `Campaign's id for update`,
    example: 'Y',
    type: String,
  })
  @IsOptional()
  @IsString()
  id?: string;
  @ApiProperty({
    description: `Campaign's name`,
    example: 'Y',
    type: String,
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: `Campaign's earning percentage`,
    example: 2,
    type: Number,
  })
  @IsNumber()
  earningPercentage: number;

  @ApiProperty({
    description: `Campaign's currency code`,
    example: `KFC`,
    type: String,
  })
  @IsString()
  currencyCode: string;

  @ApiProperty({
    description: `Campaign's start date in MM-DD-YYYY format`,
    example: '11-22-2024',
    type: Date,
  })
  @Transform(({ value }) => new Date(value)) // Then transform to Date
  @IsDate() // Finally validate it's a proper Date
  @Type(() => Date)
  startDate: Date;

  @ApiProperty({
    description: `Campaign's end date in MM-DD-YYYY format`,
    example: '12-23-2024',
    type: Date,
  })
  @Transform(({ value }) => new Date(value)) // Then transform to Date
  @IsDate() // Finally validate it's a proper Date
  @Type(() => Date)
  endDate: Date;

  @ApiPropertyOptional({
    description:
      'Flag indicating whether we want to forcefully activate the campaign',
    example: false,
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @ApiProperty({
    description:
      'Flag indicating whether we want to mark the campaign as soft deleted or not',
    example: false,
    type: Boolean,
  })
  @IsBoolean()
  isSoftDeleted: boolean;

  @ApiProperty({
    description:
      'Flag indicating in how much days this campaign earning will expire',
    example: 30,
  })
  @IsNumber()
  earningExpiresIn: number;
}

export class PotentialEarningForm {
  @ApiProperty({
    description: `Amount to be paid by user after loyalty deductions`,
    example: 2000,
    type: Number,
  })
  @IsNumber()
  realAmount!: number;
  @ApiProperty({
    description: `Organization MongoDB Id`,
    example: '54326235rgff5hyr2d3c34f',
    type: String,
  })
  @IsString()
  organizationId!: string;
}

export interface MergedEarnings {
  [currencyCode: string]: number;
}

export interface EarningsPerCampaign {
  currencyCode: string;
  amount: number;
  expiryDate: Date;
  organizationCampaignId: string;
  earningExpiresIn: number;
}

export interface CampaignExpiryReminderJobParams {
  campaignId: string;
}

export interface CampaignExpiryReminderJobParams {
  campaignId: string;
  reminderType?: 'initial' | 'followup1' | 'followup2' | 'final';
  message?: string;
}

export interface NotificationSchedule {
  reminderType: 'initial' | 'followup1' | 'followup2' | 'final';
  daysBeforeExpiry: number;
  message: string;
  priority: 'highest' | 'high' | 'normal' | 'low' | 'lowest';
}
