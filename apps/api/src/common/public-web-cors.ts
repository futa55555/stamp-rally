import type { INestApplication } from '@nestjs/common';

export function enablePublicWebCors(app: INestApplication, value?: string) {
  if (!value?.trim()) return;
  const url = new URL(value.trim());
  const local =
    url.protocol === 'http:' &&
    ['localhost', '127.0.0.1'].includes(url.hostname);
  if (
    (!local && (url.protocol !== 'https:' || url.port)) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error(
      'INVITATION_PUBLIC_ORIGIN must be an HTTPS origin (or local HTTP origin)',
    );
  app.enableCors({
    origin: [url.origin],
    methods: ['POST'],
    allowedHeaders: ['Content-Type'],
    credentials: false,
  });
}
