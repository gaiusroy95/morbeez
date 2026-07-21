import { randomUUID } from 'node:crypto';
import { supabase } from '../../lib/supabase.js';
import { AppError } from '../../lib/errors.js';
const BUCKET = 'field-visits';
const MAX_BYTES = 5 * 1024 * 1024;
export const fieldStorageService = {
    async uploadPhotos(farmerId, files, commandId) {
        if (!files.length)
            return [];
        if (files.length > 8)
            throw new AppError('Maximum 8 photos per visit', 400, 'TOO_MANY_FILES');
        const urls = [];
        for (let index = 0; index < files.length; index += 1) {
            const file = files[index];
            const raw = file.dataBase64.replace(/^data:[^;]+;base64,/, '');
            const buffer = Buffer.from(raw, 'base64');
            if (buffer.length > MAX_BYTES) {
                throw new AppError(`File ${file.filename} exceeds 5MB`, 400, 'FILE_TOO_LARGE');
            }
            const ext = file.mimeType === 'image/png'
                ? 'png'
                : file.mimeType === 'image/webp'
                    ? 'webp'
                    : 'jpg';
            const path = commandId
                ? `${farmerId}/staging/${commandId}/${index}.${ext}`
                : `${farmerId}/${randomUUID()}.${ext}`;
            const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
                contentType: file.mimeType || 'image/jpeg',
                upsert: Boolean(commandId),
            });
            if (error) {
                throw new AppError(`Photo upload failed: ${error.message}. Ensure storage bucket "field-visits" exists.`, 502, 'STORAGE_UPLOAD_FAILED');
            }
            const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
            urls.push(data.publicUrl);
        }
        return urls;
    },
    async cleanupStagedCommand(farmerId, commandId) {
        const prefix = `${farmerId}/staging/${commandId}`;
        const { data, error } = await supabase.storage.from(BUCKET).list(prefix);
        if (error || !data?.length)
            return;
        await supabase.storage
            .from(BUCKET)
            .remove(data.map((item) => `${prefix}/${item.name}`));
    },
};
//# sourceMappingURL=field-storage.service.js.map