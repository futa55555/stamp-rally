import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ConfigService } from '@nestjs/config';
import { enablePublicWebCors } from './common/public-web-cors.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  enablePublicWebCors(
    app,
    app.get(ConfigService).get<string>('INVITATION_PUBLIC_ORIGIN'),
  );
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
