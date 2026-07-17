import { Injectable } from '@nestjs/common';
import type { Clock } from '../application/clock';

@Injectable()
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
