import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { createTypeOrmMigrationOptions } from './typeorm-migration.options';

export const typeOrmMigrationDataSource = new DataSource(
  createTypeOrmMigrationOptions(process.env),
);

export default typeOrmMigrationDataSource;
