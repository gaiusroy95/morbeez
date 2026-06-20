import type { VisitPhotoDraft } from '@/components/field-findings/wizard/types';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as number[]);
  }
  const btoaFn = (globalThis as { btoa?: (s: string) => string }).btoa;
  if (typeof btoaFn === 'function') return btoaFn(binary);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    result += chars[a >> 2];
    result += chars[((a & 3) << 4) | (b >> 4)];
    result += i + 1 < bytes.length ? chars[((b & 15) << 2) | (c >> 6)] : '=';
    result += i + 2 < bytes.length ? chars[c & 63] : '=';
  }
  return result;
}

async function blobToBase64(blob: Blob): Promise<string | null> {
  try {
    const buffer = await blob.arrayBuffer();
    return arrayBufferToBase64(buffer);
  } catch {
    if (typeof FileReader === 'undefined') return null;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result;
        if (typeof dataUrl !== 'string') {
          resolve(null);
          return;
        }
        resolve(dataUrl.split(',')[1] ?? null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  }
}

export async function remoteImageToVisitPhotoDraft(
  url: string,
  photoType = 'leaf',
  caption?: string | null
): Promise<VisitPhotoDraft | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const mimeType = blob.type || 'image/jpeg';
    const dataBase64 = (await blobToBase64(blob)) ?? '';
    const filename = url.split('/').pop()?.split('?')[0] || `farmer-${Date.now()}.jpg`;
    return {
      uri: url,
      filename,
      mimeType,
      dataBase64,
      photoType,
    };
  } catch {
    return {
      uri: url,
      filename: `farmer-${Date.now()}.jpg`,
      mimeType: 'image/jpeg',
      dataBase64: '',
      photoType,
    };
  }
}

export async function ensureVisitPhotoBase64(photos: VisitPhotoDraft[]): Promise<VisitPhotoDraft[]> {
  return Promise.all(
    photos.map(async (photo) => {
      if (photo.dataBase64?.length) return photo;
      if (!photo.uri.startsWith('http')) return photo;
      const filled = await remoteImageToVisitPhotoDraft(photo.uri, photo.photoType);
      return filled ?? photo;
    })
  );
}
