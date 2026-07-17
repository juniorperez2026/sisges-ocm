import { Module } from '@nestjs/common';
import { SqlServerConnectionService } from './sql-server/sql-server-connection.service';

@Module({
  providers: [SqlServerConnectionService],
  exports: [SqlServerConnectionService],
})
export class DatabaseModule {}
