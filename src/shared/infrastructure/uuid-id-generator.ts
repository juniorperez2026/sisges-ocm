import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { IdGenerator } from '../application/id-generator';

@Injectable()
export class UuidIdGenerator implements IdGenerator {
  generate(): string {
    return randomUUID();
  }
}
