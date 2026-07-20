import { Type } from 'class-transformer';
import { IsInt, IsString, IsUUID, Matches, Min } from 'class-validator';

export class CreateCallDto {
  @IsUUID('4')
  agentSessionId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  debtorId!: number;

  @IsString()
  @Matches(/^\d{1,100}$/, {
    message: 'sourcePhoneId must contain only digits',
  })
  sourcePhoneId!: string;
}
