export type OpenAiQuotaInfo = {
    isQuotaIssue: boolean;
    httpStatus?: number;
    errorCode?: string;
    errorType?: string;
    message?: string;
};
/** Detect billing / rate-limit / quota exhaustion from OpenAI HTTP responses. */
export declare function parseOpenAiHttpError(status: number, bodyText: string): OpenAiQuotaInfo;
export declare function logOpenAiQuotaInsufficient(context: string, info: OpenAiQuotaInfo, extra?: Record<string, unknown>): void;
export declare function isOpenAiQuotaAppError(err: unknown): boolean;
//# sourceMappingURL=openai-quota.service.d.ts.map