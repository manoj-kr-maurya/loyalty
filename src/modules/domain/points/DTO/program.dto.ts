import { ApiProperty } from '@nestjs/swagger';
import * as Joi from 'joi';

export class ProgramFormDto {
  @ApiProperty() name: string;
  @ApiProperty() description: string;
  @ApiProperty() rewardCurrency: string;
  @ApiProperty() status: string;
  @ApiProperty() budgetEnabled: boolean;
  @ApiProperty() expiryNotification: boolean;
  @ApiProperty() priority: number;
  @ApiProperty() programType: string;
  @ApiProperty() business: string;
  @ApiProperty() category: string;
}

export const ProgramFormSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  rewardCurrency: Joi.string().required(),
  status: Joi.string().required(),
  budgetEnabled: Joi.boolean().required(),
  expiryNotification: Joi.boolean().required(),
  priority: Joi.number().integer().required(),
  programType: Joi.string().required(),
  business: Joi.string().required(),
  category: Joi.string().required(),
});
