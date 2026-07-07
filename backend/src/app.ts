import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { ZodError } from 'zod';
import { AppError } from './lib/errors.js';
import { healthRoutes } from './routes/health.js';
import { shopifyWebhookRoutes } from './routes/webhooks/shopify.routes.js';
import { razorpayWebhookRoutes } from './routes/webhooks/razorpay.routes.js';
import { shiprocketWebhookRoutes } from './routes/webhooks/shiprocket.routes.js';
import { whatsappWebhookRoutes } from './routes/webhooks/whatsapp.routes.js';
import { exotelWebhookRoutes } from './routes/webhooks/exotel.routes.js';
import { farmersRoutes } from './routes/api/farmers.routes.js';
import { leadsRoutes } from './routes/api/leads.routes.js';
import { shopifyProxyRoutes } from './routes/proxy/shopify-proxy.routes.js';
import { advisoryRoutes } from './routes/api/advisory.routes.js';
import { diagnosisRoutes } from './routes/api/diagnosis.routes.js';
import { authRoutes } from './routes/api/auth.routes.js';
import { farmerPortalRoutes } from './routes/api/farmer-portal.routes.js';
import { i18nRoutes } from './routes/api/i18n.routes.js';
import { shopifyOAuthRoutes } from './routes/auth/shopify-oauth.routes.js';
import { checkoutRoutes } from './routes/api/checkout.routes.js';
import { storeRoutes } from './routes/api/store.routes.js';
import { quotesRoutes } from './routes/api/quotes.routes.js';
import { partnerApiRoutes } from './routes/partner/partner-api.routes.js';
import { adminRoutes } from './routes/admin/admin.routes.js';
import { registerEventHandlers } from './events/registerHandlers.js';
import {
  LEGACY_CONSOLE_PATH,
  STAFF_API_V1,
  STAFF_PORTAL_PATH,
} from './lib/staff-portal.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fieldPwaStaticRoot = path.join(__dirname, '../field-pwa/dist');

function buildCorsOrigin(): boolean | (string | RegExp)[] {
  if (env.NODE_ENV !== 'production') return true;

  const origins: (string | RegExp)[] = [
    /morbeez\.in$/i,
    /\.myshopify\.com$/i,
    /onrender\.com$/i,
    /\.vercel\.app$/i,
  ];

  if (env.ADMIN_UI_ORIGIN) {
    for (const part of env.ADMIN_UI_ORIGIN.split(',')) {
      const trimmed = part.trim();
      if (trimmed) origins.push(trimmed);
    }
  }

  return origins;
}

function staffConsoleRedirectUrl(): string | null {
  const base = env.CONSOLE_PUBLIC_URL?.replace(/\/$/, '');
  return base || null;
}

export async function buildApp() {
  const app = Fastify({
    logger: false,
    trustProxy: true,
    bodyLimit: env.UPLOAD_BODY_LIMIT_BYTES,
  });

  await app.register(cors, { origin: buildCorsOrigin() });

  await app.register(helmet, { contentSecurityPolicy: false });

  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      const hint =
        error.details &&
        typeof error.details === 'object' &&
        'hint' in error.details &&
        typeof (error.details as { hint?: unknown }).hint === 'string'
          ? (error.details as { hint: string }).hint
          : undefined;
      return reply.code(error.statusCode).send({
        ok: false,
        error: error.code,
        message: error.message,
        ...(hint ? { hint } : {}),
      });
    }
    if (error instanceof ZodError) {
      const message = error.errors
        .map((e) => (e.path.length ? `${e.path.join('.')}: ${e.message}` : e.message))
        .join('; ');
      return reply.code(400).send({ ok: false, error: 'VALIDATION_ERROR', message });
    }
    const errCode = (error as { code?: string }).code;
    if (errCode === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      return reply.code(413).send({
        ok: false,
        error: 'PAYLOAD_TOO_LARGE',
        message: 'Request too large (usually too many photos). Use up to 4 photos or retake at lower resolution.',
      });
    }
    logger.error({ err: error }, 'Unhandled error');
    return reply.code(500).send({ ok: false, error: 'INTERNAL_ERROR', message: 'Internal server error' });
  });

  registerEventHandlers();

  await app.register(healthRoutes);
  await app.register(shopifyOAuthRoutes);
  await app.register(shopifyWebhookRoutes);
  await app.register(razorpayWebhookRoutes);
  await app.register(shiprocketWebhookRoutes);
  await app.register(whatsappWebhookRoutes);
  await app.register(exotelWebhookRoutes);
  await app.register(authRoutes);
  await app.register(farmerPortalRoutes);
  await app.register(i18nRoutes);
  await app.register(storeRoutes);
  await app.register(checkoutRoutes);
  await app.register(quotesRoutes);
  await app.register(adminRoutes);
  await app.register(partnerApiRoutes);

  const consoleUrl = staffConsoleRedirectUrl();
  const portalMovedHandler = async (
    _request: import('fastify').FastifyRequest,
    reply: import('fastify').FastifyReply
  ) => {
    if (consoleUrl) return reply.redirect(consoleUrl);
    return reply.code(410).send({
      error: 'CONSOLE_MOVED',
      message:
        'Staff console UI is no longer served from this API. Set CONSOLE_PUBLIC_URL (e.g. your Vercel deployment) or use the separate frontend app.',
    });
  };

  app.get(STAFF_PORTAL_PATH, portalMovedHandler);
  app.get(`${STAFF_PORTAL_PATH}/*`, portalMovedHandler);
  app.get(LEGACY_CONSOLE_PATH, portalMovedHandler);
  app.get(`${LEGACY_CONSOLE_PATH}/*`, portalMovedHandler);
  app.get('/admin', portalMovedHandler);
  app.get('/admin/', portalMovedHandler);

  const fieldIndexPath = path.join(fieldPwaStaticRoot, 'index.html');
  const fieldBuilt = fs.existsSync(fieldIndexPath);
  const fieldPrefix = '/field/';

  if (fieldBuilt) {
    await app.register(fastifyStatic, {
      root: fieldPwaStaticRoot,
      prefix: fieldPrefix,
      decorateReply: false,
    });
    app.get('/field', async (_request, reply) => reply.redirect(fieldPrefix));
  }

  await app.register(farmersRoutes);
  await app.register(leadsRoutes);
  await app.register(advisoryRoutes);
  await app.register(diagnosisRoutes);
  await app.register(shopifyProxyRoutes);

  app.setNotFoundHandler(async (request, reply) => {
    const url = (request.url.split('?')[0] ?? '').replace(/\/+$/, '') || '/';

    if (url.startsWith(`${STAFF_API_V1}/`) || url === STAFF_API_V1) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'API route not found' });
    }

    if (url.startsWith('/field') && fieldBuilt) {
      return reply.sendFile('index.html', fieldPwaStaticRoot);
    }

    return reply.code(404).send({ error: 'NOT_FOUND', message: 'Not found' });
  });

  return app;
}
