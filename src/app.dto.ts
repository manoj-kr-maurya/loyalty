import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyInviteForm {
  @ApiProperty({
    description: `Invite code`,
    example: 'nfjhn4oiufhoci3uf948fyjof7y4t987yc90',
    type: String,
  })
  @IsNotEmpty({ message: 'Invite code must not be empty.' })
  @IsString({ message: 'Invite code must be a string.' })
  inviteCode: string;
}
