import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class GetInTouchMeta {
  @ApiProperty({ example: 'John Doe', required: true })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 'john.doe@example.com', required: true })
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({
    example: 'I have a question about your product.',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message!: string;
}

export class GetInTouch {
  @ApiProperty({ description: 'Template meta info', required: true })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => GetInTouchMeta)
  metaData!: GetInTouchMeta;
}
