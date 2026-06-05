import { api } from './api';

const base = '/morbeez-staff/api/v1/os/telecaller';

export type QuoteSendResult = {
  whatsappUrl?: string | null;
  mailtoUrl?: string | null;
  whatsappSent?: boolean;
  emailSent?: boolean;
};

export function openQuoteSendLinks(result: QuoteSendResult) {
  if (result.whatsappUrl && !result.whatsappSent) {
    window.open(result.whatsappUrl, '_blank', 'noopener');
  }
  if (result.mailtoUrl) {
    window.location.href = result.mailtoUrl;
  }
}

export async function sendQuoteToFarmer(
  leadId: string,
  estimateId: string,
  channels: Array<'whatsapp' | 'email'>
): Promise<QuoteSendResult> {
  const res = await api<{ ok: boolean } & QuoteSendResult>(
    `${base}/leads/${leadId}/estimates/${estimateId}/send`,
    {
      method: 'POST',
      body: JSON.stringify({ channels }),
    }
  );
  return res;
}

export async function getQuoteShareLinks(leadId: string, estimateId: string) {
  return api<{
    ok: boolean;
    whatsappUrl?: string | null;
    mailtoUrl?: string | null;
    text?: string;
  }>(`${base}/leads/${leadId}/estimates/${estimateId}/share`);
}
