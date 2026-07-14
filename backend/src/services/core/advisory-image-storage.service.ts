import { randomUUID } from 'node:crypto';
import { supabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';

const BUCKET = 'advisory-images';
const MAX_BYTES = 8 * 1024 * 1024;

/** Persist farmer WhatsApp / API crop photos for agronomist case review. */
export const advisoryImageStorageService = {
  async uploadFromBase64(
    farmerId: string,
    dataBase64: string,
    mimeType = 'image/jpeg'
  ): Promise<string | null> {
    const raw = dataBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(raw, 'base64');
    if (!buffer.length) return null;
    if (buffer.length > MAX_BYTES) {
      logger.warn({ farmerId, bytes: buffer.length }, 'Advisory image too large — skipped storage');
      return null;
    }

    const ext =
      mimeType === 'application/pdf' || mimeType.includes('pdf')
        ? 'pdf'
        : mimeType === 'image/png'
          ? 'png'
          : mimeType === 'image/webp'
            ? 'webp'
            : 'jpg';
    const path = `${farmerId}/${randomUUID()}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType:
        ext === 'pdf'
          ? 'application/pdf'
          : mimeType.startsWith('image/')
            ? mimeType
            : 'image/jpeg',
      upsert: false,
    });

    if (error) {
      logger.error({ err: error, farmerId }, 'Advisory image upload failed');
      return null;
    }

    return path;
  },
};

export async function downloadAdvisoryImageBase64(
  path: string | null | undefined
): Promise<{ base64: string; mimeType: string } | null> {
  if (!path?.trim()) return null;
  const key = path.trim();

  const { data, error } = await supabase.storage.from(BUCKET).download(key);
  if (error || !data) {
    logger.warn({ err: error, path: key }, 'Advisory image download failed');
    return null;
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  if (!buffer.length) return null;

  const ext = key.split('.').pop()?.toLowerCase();
  const mimeType =
    ext === 'png'
      ? 'image/png'
      : ext === 'webp'
        ? 'image/webp'
        : ext === 'pdf'
          ? 'application/pdf'
          : 'image/jpeg';

  return { base64: buffer.toString('base64'), mimeType };
}

export async function resolveAdvisoryImageUrl(path: string | null | undefined): Promise<string | null> {
  if (!path?.trim()) return null;
  const key = path.trim();

  if (/^https?:\/\//i.test(key)) return key;

  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(key, 3600);
  if (!signErr && signed?.signedUrl) return signed.signedUrl;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
  return data?.publicUrl ?? null;
}

export function urlFromWhatsAppPayload(payload: Record<string, unknown> | null | undefined): string | null {
  if (!payload) return null;

  const nested = payload.message as Record<string, unknown> | undefined;
  const sources = [payload, nested].filter(Boolean) as Record<string, unknown>[];

  for (const src of sources) {
    const image = src.image as Record<string, string> | undefined;
    if (image?.url?.startsWith('http')) return image.url;
    const mediaUrl = src.media_url;
    if (typeof mediaUrl === 'string' && mediaUrl.startsWith('http')) return mediaUrl;
    const headerImage = src.header_image;
    if (typeof headerImage === 'string' && headerImage.startsWith('http')) return headerImage;
    const doc = src.document as Record<string, string> | undefined;
    if (doc?.url?.startsWith('http') && String(doc.mime_type ?? '').startsWith('image/')) {
      return doc.url;
    }
  }

  return null;
}
