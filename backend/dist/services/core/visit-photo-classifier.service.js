import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { openaiTokenLimitBody } from '../ai/providers/openai-chat-params.js';
import { imageInputClassifierService } from '../whatsapp/pipeline/image-input-classifier.service.js';
const RHIZOME_CROPS = /ginger|turmeric|yam|colocasia|taro|elephant/;
function isFieldLevelPhotoType(photoType) {
    const key = photoType.toLowerCase();
    return /whole|field|plot|overview|drainage|plant|bush|palm/.test(key);
}
function isSymptomPhotoType(photoType) {
    const key = photoType.toLowerCase();
    return /leaf|disease|pest|symptom|rhizome|stem|fruit|root|spot|close/.test(key);
}
function pickFromList(raw, availableTypes) {
    const key = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
    return availableTypes.find((t) => t.toLowerCase() === key) ?? null;
}
/** Map vision / WhatsApp classifier categories to a visit photo type for a crop. */
export function mapClassifierCategoryToVisitPhotoType(category, cropType, availableTypes) {
    const avail = new Set(availableTypes.map((t) => t.toLowerCase()));
    const pick = (...candidates) => candidates.find((c) => avail.has(c.toLowerCase())) ?? availableTypes[0] ?? 'other';
    const cat = category.toLowerCase().replace(/\s+/g, '_');
    const crop = cropType.toLowerCase();
    if (cat === 'soil' || cat === 'root_soil' || cat === 'drainage') {
        return pick('drainage', 'soil', 'whole_field');
    }
    if (cat === 'root' || cat === 'rhizome') {
        if (RHIZOME_CROPS.test(crop))
            return pick('rhizome', 'root');
        return pick('root', 'rhizome');
    }
    if (cat === 'insect' || cat === 'pest')
        return pick('pest');
    if (cat === 'disease' || cat === 'disease_symptom' || cat === 'disease_stress') {
        return pick('disease', 'leaf');
    }
    if (cat === 'crop_leaf' || cat === 'leaf' || cat === 'symptom') {
        if (RHIZOME_CROPS.test(crop) && avail.has('leaf'))
            return 'leaf';
        return pick('leaf', 'disease', 'rhizome');
    }
    if (cat === 'whole_field' || cat === 'field' || cat === 'plot' || cat === 'wide') {
        return pick('whole_field', 'field_overview', 'field');
    }
    if (cat === 'plant' || cat === 'bush' || cat === 'palm' || cat === 'tree') {
        return pick('plant', 'bush', 'palm', 'pseudo_stem');
    }
    if (cat === 'stem' || cat === 'pseudo_stem' || cat === 'trunk') {
        return pick('stem', 'pseudo_stem', 'trunk');
    }
    if (cat === 'weed')
        return pick('other', 'whole_field');
    return pick('leaf', 'plant', 'whole_field', 'other');
}
export { isFieldLevelPhotoType, isSymptomPhotoType };
function parseVisionPhotoJson(text, availableTypes) {
    try {
        const parsed = JSON.parse(text);
        const fromAi = parsed.photo_type ? pickFromList(parsed.photo_type, availableTypes) : null;
        if (!fromAi)
            return null;
        return {
            photoType: fromAi,
            confidence: Math.max(0.05, Math.min(0.98, Number(parsed.confidence) || 0.72)),
            source: 'vision',
            label: parsed.scene ? String(parsed.scene) : undefined,
        };
    }
    catch {
        return null;
    }
}
export const visitPhotoClassifierService = {
    async classify(params) {
        const available = params.availableTypes.length ? params.availableTypes : ['whole_field', 'leaf', 'other'];
        const mime = params.mimeType ?? 'image/jpeg';
        const typeList = available.join(', ');
        if (env.OPENAI_API_KEY) {
            try {
                const res = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: env.OPENAI_VISION_MODEL,
                        ...openaiTokenLimitBody(env.OPENAI_VISION_MODEL, 220),
                        temperature: 0.1,
                        response_format: { type: 'json_object' },
                        messages: [
                            {
                                role: 'system',
                                content: `Classify a field visit photo for ${params.cropType}. photo_type MUST be one of: ${typeList}. ` +
                                    'whole_field=wide plot; plant=single plant; leaf=leaf close-up with symptoms; rhizome=tuber/underground stem; ' +
                                    'pest=insect; disease=lesions; drainage=soil. Return JSON only.',
                            },
                            {
                                role: 'user',
                                content: [
                                    { type: 'text', text: `Farmer note: ${params.caption ?? '(none)'}` },
                                    {
                                        type: 'image_url',
                                        image_url: {
                                            url: `data:${mime};base64,${params.dataBase64}`,
                                            detail: 'low',
                                        },
                                    },
                                ],
                            },
                        ],
                    }),
                });
                if (res.ok) {
                    const data = (await res.json());
                    const parsed = parseVisionPhotoJson(data.choices?.[0]?.message?.content ?? '', available);
                    if (parsed)
                        return parsed;
                }
            }
            catch (err) {
                logger.warn({ err }, 'Visit photo vision classify failed');
            }
        }
        const vision = await imageInputClassifierService.classifyImage({
            imageBase64: params.dataBase64,
            imageMimeType: mime,
            caption: params.caption,
        });
        if (!vision)
            return null;
        return {
            photoType: mapClassifierCategoryToVisitPhotoType(vision.primaryCategory, params.cropType, available),
            confidence: vision.confidence,
            source: 'heuristic',
            label: vision.hints[0],
        };
    },
};
//# sourceMappingURL=visit-photo-classifier.service.js.map