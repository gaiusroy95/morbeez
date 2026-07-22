import { createHash } from 'crypto';
import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
export function hashVisitImageBase64(dataBase64) {
    const normalized = dataBase64.replace(/\s/g, '');
    const buffer = Buffer.from(normalized, 'base64');
    return createHash('sha256').update(buffer).digest('hex');
}
export function normalizeVisitImageCropType(cropType) {
    return (cropType ?? '').trim().toLowerCase();
}
export async function lookupVisitImageDiagnosis(contentHash, cropType) {
    const crop = normalizeVisitImageCropType(cropType);
    const { data, error } = await supabase
        .from('visit_image_diagnosis_cache')
        .select('label, confidence, source')
        .eq('content_hash', contentHash)
        .eq('crop_type', crop)
        .maybeSingle();
    throwIfSupabaseError(error, 'Visit image diagnosis cache lookup failed');
    if (!data?.label)
        return null;
    const source = String(data.source);
    if (source !== 'plant_id' && source !== 'vision' && source !== 'fusion')
        return null;
    return {
        label: String(data.label),
        confidence: Number(data.confidence),
        source,
        photoCount: 1,
    };
}
export async function storeVisitImageDiagnosis(contentHash, cropType, signal) {
    const crop = normalizeVisitImageCropType(cropType);
    const { error } = await supabase.from('visit_image_diagnosis_cache').upsert({
        content_hash: contentHash,
        crop_type: crop,
        label: signal.label,
        confidence: signal.confidence,
        source: signal.source,
        updated_at: new Date().toISOString(),
    }, { onConflict: 'content_hash,crop_type' });
    throwIfSupabaseError(error, 'Visit image diagnosis cache store failed');
}
//# sourceMappingURL=visit-image-diagnosis-cache.service.js.map