export type HealthResponse = {
  health: HealthStatus;
};

type HealthStatus = 'ok' | 'error';
