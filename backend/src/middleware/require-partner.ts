import type { FastifyRequest } from 'fastify';
import { getBearerToken } from '../lib/jwt.js';
import { verifyPartnerToken } from '../lib/partner-jwt.js';
import { UnauthorizedError } from '../lib/errors.js';
import { partnerService } from '../services/partner/partner.service.js';

export type PartnerRequest = FastifyRequest & {
  partner: Awaited<ReturnType<typeof partnerService.getById>>;
};

export async function requirePartner(request: FastifyRequest) {
  const token = getBearerToken(request.headers.authorization);
  if (!token) throw new UnauthorizedError('Partner sign-in required');
  const payload = verifyPartnerToken(token);
  const profile = await partnerService.getById(payload.sub);
  if (!profile) throw new UnauthorizedError('Partner account not found');
  if (!['active', 'certified', 'training'].includes(profile.status)) {
    throw new UnauthorizedError('Partner account is not active');
  }
  return profile;
}
