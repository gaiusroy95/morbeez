import { supabase } from '../../../lib/supabase.js';
import { logger } from '../../../lib/logger.js';
const BUCKET = 'market-insights';
export const marketInsightStorageService = {
    storagePath(farmerId, insightDate) {
        return `${farmerId}/${insightDate}.png`;
    },
    async uploadPng(farmerId, insightDate, buffer) {
        const path = this.storagePath(farmerId, insightDate);
        const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
            contentType: 'image/png',
            upsert: true,
        });
        if (error) {
            logger.error({ err: error, farmerId, insightDate }, 'Market insight image upload failed');
            return null;
        }
        return path;
    },
    publicUrl(storagePath) {
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
        return data?.publicUrl ?? null;
    },
};
//# sourceMappingURL=market-insight-storage.service.js.map