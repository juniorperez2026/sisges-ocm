import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class StartAgentSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  agentId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  extensionId!: string;
}
