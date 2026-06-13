import type { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';
import { farmerAuthService } from '../../services/auth/farmer-auth.service.js';
import { farmerOtpService } from '../../services/auth/farmer-otp.service.js';
import { getBearerToken, verifyFarmerToken } from '../../lib/jwt.js';
import { UnauthorizedError } from '../../lib/errors.js';
import { env } from '../../config/env.js';

const signupSchema = z.object({
  email: z.union([z.string().email().max(255), z.literal('')]).optional(),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  phone: z.string().min(10).max(20),
  password: z.string().min(8).max(128),
  acceptTerms: z.literal(true),
  newsletter: z.boolean().default(false),
  channel: z.enum(['website', 'mobile']).optional(),
  utmCampaign: z.string().max(200).optional(),
  utmSource: z.string().max(200).optional(),
  utmMedium: z.string().max(200).optional(),
  partnerCode: z.string().max(64).optional(),
  qrToken: z.string().max(128).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

const otpSendSchema = z.object({
  phone: z.string().min(10).max(20),
});

const otpVerifySchema = z.object({
  phone: z.string().min(10).max(20),
  code: z.string().min(4).max(8),
  partnerCode: z.string().max(64).optional(),
  qrToken: z.string().max(128).optional(),
});

/**
 * Storefront farmer auth — called from theme JS (CORS).
 * App proxy path /apps/morbeez/auth/* mirrors these at /proxy/auth/* when configured.
 */
export async function authRoutes(app: FastifyInstance): Promise<void> {
  await app.register(async (authApp) => {
    await authApp.register(rateLimit, {
      max: env.AUTH_RATE_LIMIT_MAX,
      timeWindow: env.RATE_LIMIT_WINDOW_MS,
    });

    authApp.post('/api/v1/auth/signup', async (request, reply) => {
      const body = signupSchema.parse(request.body);
      const result = await farmerAuthService.signup(body);
      return reply.code(201).send({ ok: true, ...result });
    });

    authApp.post('/api/v1/auth/login', async (request, reply) => {
      const body = loginSchema.parse(request.body);
      const result = await farmerAuthService.login(body);
      return reply.send({ ok: true, ...result });
    });

    authApp.post('/api/v1/auth/otp/send', async (request, reply) => {
      const body = otpSendSchema.parse(request.body);
      const ip = request.ip;
      const result = await farmerOtpService.sendOtp(body.phone, ip);
      return reply.send({ ok: true, ...result });
    });

    authApp.post('/api/v1/auth/otp/verify', async (request, reply) => {
      const body = otpVerifySchema.parse(request.body);
      const result = await farmerOtpService.verifyOtp(body.phone, body.code, {
        partnerCode: body.partnerCode,
        qrToken: body.qrToken,
      });
      return reply.send({ ok: true, ...result });
    });

    authApp.post('/api/v1/auth/change-password', async (request, reply) => {
      const token = getBearerToken(request.headers.authorization);
      if (!token) throw new UnauthorizedError('Not signed in');
      const payload = verifyFarmerToken(token);
      const body = z
        .object({
          currentPassword: z.string().min(1).max(128).optional(),
          newPassword: z.string().min(8).max(128),
          confirmPassword: z.string().min(8).max(128),
        })
        .parse(request.body);
      const result = await farmerAuthService.changePassword({
        farmerId: payload.sub,
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
        confirmPassword: body.confirmPassword,
      });
      return reply.send(result);
    });
  });

  app.get('/api/v1/auth/me', async (request, reply) => {
    const token = getBearerToken(request.headers.authorization);
    if (!token) throw new UnauthorizedError('Not signed in');
    const payload = verifyFarmerToken(token);
    const farmer = await farmerAuthService.me(payload.sub);
    return reply.send({ ok: true, farmer });
  });
}
