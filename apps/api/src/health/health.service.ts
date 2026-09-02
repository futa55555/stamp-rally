import { Injectable } from '@nestjs/common';
import type { HealthResponse } from './health-response.type.js';

@Injectable()
export class HealthService {
  getHealth(): HealthResponse {
    return {
      health: 'ok',
    };
  }
}
