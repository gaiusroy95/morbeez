import type { VisitPhotoDraft } from '@/components/field-findings/wizard/types';

async function blobToBase64(blob: Blob): Promise<string | null> {
  if (typeof FileReader === 'undefined') return null;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== 'string') {
        resolve(null);
        return;
      }
      const base64 = dataUrl.split(',')[1];
      resolve(base64 ?? null);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
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
