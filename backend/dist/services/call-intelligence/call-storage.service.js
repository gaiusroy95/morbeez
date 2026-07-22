import { randomUUID } from 'node:crypto';
import { supabase } from '../../lib/supabase.js';
import { AppError } from '../../lib/errors.js';
const BUCKET = 'call-recordings';
const MAX_BYTES = 25 * 1024 * 1024;
export const callStorageService = {
    async uploadAudio(input) {
        const raw = input.dataBase64.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(raw, 'base64');
        if (buffer.length > MAX_BYTES) {
            throw new AppError('Recording exceeds 25MB limit', 400, 'FILE_TOO_LARGE');
        }
        const ext = input.mimeType.includes('mpeg') || input.mimeType.includes('mp3')
            ? 'mp3'
            : input.mimeType.includes('wav')
                ? 'wav'
                : input.mimeType.includes('webm')
                    ? 'webm'
                    : 'm4a';
        const path = `${input.farmerId}/${input.leadId}/${randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
            contentType: input.mimeType || 'audio/m4a',
            upsert: false,
        });
        if (error) {
            throw new AppError(`Recording upload failed: ${error.message}. Ensure storage bucket "${BUCKET}" exists.`, 502, 'STORAGE_UPLOAD_FAILED');
        }
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        return { storagePath: path, publicUrl: data.publicUrl };
    },
    async download(storagePath) {
        const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
        if (error || !data) {
            throw new AppError('Could not download recording', 502, 'STORAGE_DOWNLOAD_FAILED');
        }
        const buffer = Buffer.from(await data.arrayBuffer());
        const mimeType = data.type || 'audio/m4a';
        return { buffer, mimeType };
    },
    async downloadFromUrl(url) {
        const res = await fetch(url);
        if (!res.ok) {
            throw new AppError('Could not download recording URL', 502, 'RECORDING_URL_FETCH_FAILED');
        }
        const buffer = Buffer.from(await res.arrayBuffer());
        const mimeType = res.headers.get('content-type') || 'audio/mpeg';
        return { buffer, mimeType };
    },
};
//# sourceMappingURL=call-storage.service.js.map