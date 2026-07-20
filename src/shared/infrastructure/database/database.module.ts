import { Module } from '@nestjs/common';
import { LegacySqlServerConnectionService } from './sql-server/legacy-sql-server-connection.service';
import { SqlServerConnectionService } from './sql-server/sql-server-connection.service';

@Module({
  providers: [SqlServerConnectionService, LegacySqlServerConnectionService],

  exports: [SqlServerConnectionService, LegacySqlServerConnectionService],
})
export class DatabaseModule {}
