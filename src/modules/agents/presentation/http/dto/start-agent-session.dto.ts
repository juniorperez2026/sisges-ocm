import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class StartAgentSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  agentId!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2,20}$/, {
    message: 'extensionId must contain between 2 and 20 digits',
  })
  extensionId!: string;
}
