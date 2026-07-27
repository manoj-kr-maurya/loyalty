import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class InviteAdminForm {
  @ApiProperty({
    description: `phone number`,
    example: '9899096444',
    type: String,
  })
  @IsString()
  phoneNumber!: string;

  @ApiProperty({
    description: `Shop location`,
    example: 'Ambala, Haryana',
    type: String,
  })
  @IsString()
  @MaxLength(100)
  location!: string;
}
