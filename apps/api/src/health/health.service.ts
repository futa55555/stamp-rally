import { Injectable } from '@nestjs/common';
import type { HealthResponse } from './health.model.js';

@Injectable()
export class HealthService {
  getHealth(): HealthResponse {
    return {
      health: 'ok',
    };
  }
}
