import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';

export class InviteAdminForm {
  @ApiProperty({
    description: `phone number`,
    example: '9899096444',
    type: String,
  })
  phoneNumber!: string;

  @ApiProperty({
    description: `Shop location`,
    example: 'Ambala, Haryana',
    type: String,
  })
  location!: string;
}

export const InviteAdminSchema = Joi.object({
  phoneNumber: Joi.string().required(),
  location: Joi.string().max(100).required(),
});
