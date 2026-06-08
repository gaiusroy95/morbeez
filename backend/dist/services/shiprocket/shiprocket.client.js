import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
/** Shiprocket tokens expire after 240 hours (10 days). Refresh slightly earlier. */
const TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000;
let cachedToken = null;
let authStatusCache = null;
const AUTH_STATUS_CACHE_MS = 3 * 60 * 1000;
export function clearShiprocketTokenCache() {
    cachedToken = null;
    authStatusCache = null;
}
function shiprocketCredentials() {
    const email = env.SHIPROCKET_EMAIL?.trim();
    const password = env.SHIPROCKET_PASSWORD?.trim();
    if (!email || !password)
        return null;
    return { email, password };
}
async function parseShiprocketErrorBody(res) {
    const text = await res.text();
    if (!text)
        return '';
    try {
        const parsed = JSON.parse(text);
        return String(parsed.message ?? parsed.error ?? text).trim();
    }
    catch {
        return text.trim();
    }
}
export async function verifyShiprocketAuth(opts) {
    if (!opts?.force &&
        authStatusCache &&
        Date.now() - authStatusCache.at < AUTH_STATUS_CACHE_MS) {
        return authStatusCache.status;
    }
    const creds = shiprocketCredentials();
    if (!creds) {
        const status = {
            configured: false,
            ok: false,
            error: 'SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD are not set on the API server',
            hint: 'Create an API user in Shiprocket → Settings → API, then add those credentials to Render.',
        };
        authStatusCache = { at: Date.now(), status };
        return status;
    }
    try {
        await getShiprocketToken();
        const status = { configured: true, ok: true, error: null, hint: null };
        authStatusCache = { at: Date.now(), status };
        return status;
    }
    catch (err) {
        const message = err instanceof AppError ? err.message : 'Shiprocket auth failed';
        const status = {
            configured: true,
            ok: false,
            error: message,
            hint: 'Use the dedicated API user from Shiprocket → Settings → API (not your main login). ' +
                'SHIPROCKET_PASSWORD is the API user password — not SHIPROCKET_WEBHOOK_TOKEN. ' +
                'Ensure Orders and Webhooks modules are enabled for that API user.',
        };
        authStatusCache = { at: Date.now(), status };
        return status;
    }
}
export async function getShiprocketToken() {
    if (cachedToken && Date.now() < cachedToken.expiresAt) {
        return cachedToken.token;
    }
    const creds = shiprocketCredentials();
    if (!creds) {
        throw new AppError('Shiprocket not configured', 503, 'SHIPROCKET_NOT_CONFIGURED');
    }
    const res = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: creds.email,
            password: creds.password,
        }),
    });
    if (!res.ok) {
        clearShiprocketTokenCache();
        const detail = await parseShiprocketErrorBody(res);
        const suffix = detail ? `: ${detail}` : '';
        logger.warn({ status: res.status, email: creds.email, detail }, 'Shiprocket login failed');
        throw new AppError(`Shiprocket auth failed${suffix}`, res.status === 401 || res.status === 403 ? res.status : 502, 'SHIPROCKET_AUTH_FAILED', detail);
    }
    const data = (await res.json());
    if (!data.token) {
        clearShiprocketTokenCache();
        throw new AppError('Shiprocket auth returned no token', 502, 'SHIPROCKET_AUTH_FAILED');
    }
    cachedToken = { token: data.token, expiresAt: Date.now() + TOKEN_TTL_MS };
    return data.token;
}
export async function shiprocketRequest(path, init = {}, retried = false) {
    const token = await getShiprocketToken();
    const res = await fetch(`https://apiv2.shiprocket.in${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...init.headers,
        },
    });
    if ((res.status === 401 || res.status === 403) && !retried) {
        clearShiprocketTokenCache();
        return shiprocketRequest(path, init, true);
    }
    if (!res.ok) {
        const text = await res.text();
        logger.error({ status: res.status, path, text }, 'Shiprocket API error');
        throw new AppError(`Shiprocket API ${res.status}`, res.status, 'SHIPROCKET_API_ERROR', text);
    }
    return res.json();
}
//# sourceMappingURL=shiprocket.client.js.map