import type * as ImagePicker from 'expo-image-picker';
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

/** Read base64 from a local device URI (file://, content://, ph://). */
export async function localUriToBase64(uri: string): Promise<string | null> {
  if (!uri || uri.startsWith('http')) return null;
  try {
    const res = await fetch(uri);
    if (!res.ok) return null;
    const blob = await res.blob();
    return blobToBase64(blob);
  } catch {
    return null;
  }
}

export async function imagePickerAssetToVisitPhotoDraft(
  asset: ImagePicker.ImagePickerAsset,
  photoType: string,
  index = 0
): Promise<VisitPhotoDraft | null> {
  let dataBase64 = asset.base64 ?? '';
  if (!dataBase64 && asset.uri) {
    dataBase64 = (await localUriToBase64(asset.uri)) ?? '';
  }
  if (!dataBase64) return null;

  return {
    uri: asset.uri,
    filename: asset.fileName ?? `photo-${Date.now()}-${index}.jpg`,
    mimeType: asset.mimeType ?? 'image/jpeg',
    dataBase64,
    photoType,
  };
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
