import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module';
import { HealthController } from './health.controller';
import { SqlServerHealthIndicator } from './sql-server-health.indicator';

@Module({
  imports: [TerminusModule, DatabaseModule],

  controllers: [HealthController],

  providers: [SqlServerHealthIndicator],
})
export class HealthModule {}
