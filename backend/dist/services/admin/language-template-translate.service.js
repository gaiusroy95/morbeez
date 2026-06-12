import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { openaiTokenLimitBody } from '../ai/providers/openai-chat-params.js';
const OPENAI_BASE = 'https://api.openai.com/v1/chat/completions';
const LANG_LABELS = {
    en: 'English',
    hi: 'Hindi',
    kn: 'Kannada',
    ta: 'Tamil',
    ml: 'Malayalam',
};
export const languageTemplateTranslateService = {
    async translateBody(params) {
        if (params.sourceLanguage === params.targetLanguage) {
            return params.sourceText;
        }
        if (!env.OPENAI_API_KEY) {
            throw new AppError('OpenAI not configured for translation', 503, 'OPENAI_NOT_CONFIGURED');
        }
        const res = await fetch(OPENAI_BASE, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: env.OPENAI_TEXT_MODEL,
                ...openaiTokenLimitBody(env.OPENAI_TEXT_MODEL, 800),
                messages: [
                    {
                        role: 'system',
                        content: 'You translate WhatsApp farmer messages for Indian agriculture. Keep {{VariableName}} placeholders exactly unchanged. Use natural spoken language for the target locale — not literal word-for-word translation. Return ONLY the translated message text, no quotes or explanation.',
                    },
                    {
                        role: 'user',
                        content: `Translate from ${LANG_LABELS[params.sourceLanguage]} to ${LANG_LABELS[params.targetLanguage]}:\n\n${params.sourceText}`,
                    },
                ],
            }),
        });
        if (!res.ok) {
            const text = await res.text();
            throw new AppError('Template translation failed', res.status, 'TEMPLATE_TRANSLATE_FAILED', text);
        }
        const data = (await res.json());
        return (data.choices?.[0]?.message?.content ?? '').trim() || params.sourceText;
    },
};
//# sourceMappingURL=language-template-translate.service.js.map