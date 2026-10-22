import { ApiProperty } from '@nestjs/swagger';
import { ValidateNested } from 'class-validator';

export class GetInTouchMeta {
  @ApiProperty({ example: 'John Doe', required: true })
  name!: string;

  @ApiProperty({ example: 'john.doe@example.com', required: true })
  email!: string;

  @ApiProperty({
    example: 'I have a question about your product.',
    required: true,
  })
  message!: string;
}

export class GetInTouch {
  @ApiProperty({ description: 'Template meta info', required: true })
  @ValidateNested()
  metaData!: GetInTouchMeta;
}
