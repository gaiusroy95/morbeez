import { getBearerToken, verifyFarmerToken } from '../lib/jwt.js';
import { UnauthorizedError } from '../lib/errors.js';
export function requireFarmer(request) {
    const token = getBearerToken(request.headers.authorization);
    if (!token)
        throw new UnauthorizedError('Please sign in');
    const payload = verifyFarmerToken(token);
    return { farmerId: payload.sub, email: payload.email };
}
//# sourceMappingURL=require-farmer.js.map