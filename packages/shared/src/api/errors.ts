export type ApiErrorBody = {
  message?: string;
  error?: string;
  hint?: string;
  issues?: Array<{ message?: string; path?: (string | number)[] }>;
};

export function parseApiError(data: ApiErrorBody, statusText: string): string {
  let msg = data.message || data.error || statusText || 'Request failed';
  if (data.hint) msg = `${msg} — ${data.hint}`;
  if (data.error === 'VALIDATION_ERROR' && data.message) msg = data.message;
  if (data.error === 'NOT_FOUND' && msg === 'API route not found') {
    msg = 'API route not found. Check EXPO_PUBLIC_API_BASE_URL and that the backend is running.';
  }
  if (data.error === 'DATABASE_SCHEMA') msg = data.message ?? msg;
  return msg;
}
