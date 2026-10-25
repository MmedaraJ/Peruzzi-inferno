import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import { json, raw } from 'express';

// local runs read apps/api/.env; on Railway the variables are set on the service
for (const p of [path.join(process.cwd(), '.env'), path.join(__dirname, '../../.env')]) if (fs.existsSync(p)) { try { (process as any).loadEnvFile(p); } catch {} break; }

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error', 'warn', 'log'], bodyParser: false });
  app.set('trust proxy', true);
  // no framework banner, and the basic protections on every reply (no Content-Security-Policy: the /q, /a and /t link
  // preview pages send people on with an inline script)
  app.disable('x-powered-by');
  app.use((_req: unknown, res: { setHeader(k: string, v: string): void }, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); res.setHeader('X-Frame-Options', 'DENY');
    next();
  });
  // gzip for the JSON and the preview pages (the cards and the audio are already compressed and pass through as they are)
  app.use(compression());
  // the cards (jpeg) and Peruzzi's recordings arrive as raw bytes; everything else is JSON
  app.use('/api/cards', raw({ type: 'image/*', limit: '3mb' }));
  app.use('/api/admin/voice-lines', raw({ type: 'audio/*', limit: '6mb' }));
  app.use('/api/admin/sounds', raw({ type: 'audio/*', limit: '6mb' }));
  app.use(json({ limit: '200kb' }));
  app.enableCors({ origin: true, credentials: false, allowedHeaders: ['Content-Type', 'x-admin-password', 'x-admin-token', 'x-token'] });
  if (!process.env.HASH_SECRET) new Logger('secrets').warn('HASH_SECRET is not set, so ADMIN_PASSWORD keys the opt-out list and signs the opt-out links and senders’ tokens. Set HASH_SECRET to the current ADMIN_PASSWORD before ever changing the password, or people who opted out could be emailed again (README → Deploy).');
  // on SIGTERM (a redeploy), Prisma disconnects and the stage's timers stop before the process goes
  app.enableShutdownHooks(['SIGTERM', 'SIGINT']);
  const port = Number(process.env.PORT || 4000);
  await app.listen(port, '0.0.0.0');
  console.log(`api listening on :${port} (web ${process.env.WEB_URL || 'http://localhost:5173'})`);
  // deployed without the site's or its own address, the links in emails would lead to localhost
  if ((process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production') && (!process.env.WEB_URL || !process.env.API_URL)) {
    console.warn(`WARNING: ${[!process.env.WEB_URL && 'WEB_URL (the site’s address)', !process.env.API_URL && 'API_URL (this API’s address)'].filter(Boolean).join(' and ')} not set: links in emails will point at localhost. Set them in the service's variables.`);
  }
}
bootstrap();
