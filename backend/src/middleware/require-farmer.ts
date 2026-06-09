import type { FastifyRequest } from 'fastify';
import { getBearerToken, verifyFarmerToken } from '../lib/jwt.js';
import { UnauthorizedError } from '../lib/errors.js';

export function requireFarmer(request: FastifyRequest): { farmerId: string; email: string } {
  const token = getBearerToken(request.headers.authorization);
  if (!token) throw new UnauthorizedError('Please sign in');
  const payload = verifyFarmerToken(token);
  return { farmerId: payload.sub, email: payload.email };
}
