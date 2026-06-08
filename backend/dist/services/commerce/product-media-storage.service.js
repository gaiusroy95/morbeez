import { randomUUID } from 'node:crypto';
import { supabase } from '../../lib/supabase.js';
import { AppError, ValidationError } from '../../lib/errors.js';
const BUCKET = 'product-assets';
const MAX_BYTES = {
    image: 5 * 1024 * 1024,
    pdf: 10 * 1024 * 1024,
    video: 50 * 1024 * 1024,
};
const ALLOWED_MIME = {
    image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    pdf: ['application/pdf'],
    video: ['video/mp4', 'video/quicktime'],
};
function kindFromMime(mime) {
    if (ALLOWED_MIME.image.includes(mime))
        return 'image';
    if (ALLOWED_MIME.pdf.includes(mime))
        return 'pdf';
    if (ALLOWED_MIME.video.includes(mime))
        return 'video';
    return null;
}
function extFromMime(mime, fileName) {
    const fromName = fileName.split('.').pop()?.toLowerCase();
    if (fromName && fromName.length <= 5)
        return fromName;
    if (mime === 'image/png')
        return 'png';
    if (mime === 'image/webp')
        return 'webp';
    if (mime === 'image/gif')
        return 'gif';
    if (mime === 'application/pdf')
        return 'pdf';
    if (mime === 'video/quicktime')
        return 'mov';
    return 'jpg';
}
export const productMediaStorageService = {
    async upload(input) {
        const mime = (input.mimeType || '').toLowerCase().split(';')[0].trim();
        const kind = kindFromMime(mime);
        if (!kind) {
            throw new ValidationError(`Unsupported file type: ${mime || 'unknown'}`);
        }
        const raw = input.dataBase64.replace(/^data:[^;]+;base64,/, '').trim();
        if (!raw)
            throw new ValidationError('File data is required');
        const buffer = Buffer.from(raw, 'base64');
        const max = MAX_BYTES[kind];
        if (buffer.length > max) {
            throw new ValidationError(`File exceeds ${Math.round(max / (1024 * 1024))}MB limit`);
        }
        const folder = input.folder || kind;
        const productPart = input.productId?.trim() || 'draft';
        const ext = extFromMime(mime, input.fileName);
        const path = `${productPart}/${folder}/${randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
            contentType: mime,
            upsert: false,
        });
        if (error) {
            throw new AppError(`Upload failed: ${error.message}. Ensure storage bucket "product-assets" exists.`, 502, 'STORAGE_UPLOAD_FAILED');
        }
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        return { url: data.publicUrl, path };
    },
};
//# sourceMappingURL=product-media-storage.service.js.map