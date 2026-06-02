import { logger } from '../../lib/logger.js';
/** Detect billing / rate-limit / quota exhaustion from OpenAI HTTP responses. */
export function parseOpenAiHttpError(status, bodyText) {
    let parsed = null;
    try {
        parsed = JSON.parse(bodyText);
    }
    catch {
        parsed = null;
    }
    const err = parsed?.error;
    const code = String(err?.code ?? '').toLowerCase();
    const type = String(err?.type ?? '').toLowerCase();
    const message = String(err?.message ?? bodyText).slice(0, 500);
    const lower = `${code} ${type} ${message}`.toLowerCase();
    const isQuotaIssue = status === 429 ||
        status === 402 ||
        code === 'insufficient_quota' ||
        type === 'insufficient_quota' ||
        /\binsufficient[_\s-]?quota\b/.test(lower) ||
        /\bexceeded your current quota\b/.test(lower) ||
        /\bbilling\b/.test(lower) ||
        (status === 429 && /\brate[_\s-]?limit\b/.test(lower));
    return {
        isQuotaIssue,
        httpStatus: status,
        errorCode: code || undefined,
        errorType: type || undefined,
        message: message || undefined,
    };
}
export function logOpenAiQuotaInsufficient(context, info, extra) {
    if (!info.isQuotaIssue)
        return;
    logger.warn({
        context,
        openaiQuota: true,
        httpStatus: info.httpStatus,
        errorCode: info.errorCode,
        errorType: info.errorType,
        message: info.message,
        ...extra,
    }, 'OpenAI quota insufficient or unavailable — using knowledge-base fallback');
}
export function isOpenAiQuotaAppError(err) {
    if (!err || typeof err !== 'object')
        return false;
    const e = err;
    if (e.statusCode === 429 || e.statusCode === 402)
        return true;
    const details = String(e.details ?? '').toLowerCase();
    const code = String(e.code ?? '').toLowerCase();
    return (code.includes('openai') &&
        (details.includes('insufficient_quota') ||
            details.includes('exceeded your current quota') ||
            details.includes('rate_limit')));
}
//# sourceMappingURL=openai-quota.service.js.map