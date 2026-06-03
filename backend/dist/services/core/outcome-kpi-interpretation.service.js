import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { openaiTokenLimitBody } from '../ai/providers/openai-chat-params.js';
import { aiClassificationFromLevel, parseImprovementLevelFromText, } from '../../domain/ai-training/outcome-kpi.js';
const OPENAI_BASE = 'https://api.openai.com/v1';
export const outcomeKpiInterpretationService = {
    async interpretFarmerReply(params) {
        const snippet = params.text.trim().slice(0, 500);
        if (!snippet && !params.hasImage)
            return null;
        const rule = snippet ? parseImprovementLevelFromText(snippet) : null;
        if (rule && rule.confidence >= 0.8) {
            return {
                improvementLevel: rule.level,
                confidence: rule.confidence,
                aiClassification: aiClassificationFromLevel(rule.level, rule.confidence),
                source: 'whatsapp_text',
                rawSnippet: snippet,
            };
        }
        if (!env.OPENAI_API_KEY?.trim() || !snippet) {
            if (params.hasImage && !snippet) {
                return {
                    improvementLevel: 'slight_improvement',
                    confidence: 0.5,
                    aiClassification: 'uncertain',
                    source: 'whatsapp_text',
                    rawSnippet: '[photo only]',
                };
            }
            return rule
                ? {
                    improvementLevel: rule.level,
                    confidence: rule.confidence,
                    aiClassification: aiClassificationFromLevel(rule.level, rule.confidence),
                    source: 'whatsapp_text',
                    rawSnippet: snippet,
                }
                : null;
        }
        try {
            const langHint = params.language === 'ml'
                ? 'Malayalam or English'
                : params.language === 'hi'
                    ? 'Hindi or English'
                    : 'English or local language';
            const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: env.OPENAI_TEXT_MODEL,
                    ...openaiTokenLimitBody(env.OPENAI_TEXT_MODEL, 120),
                    temperature: 0.1,
                    response_format: { type: 'json_object' },
                    messages: [
                        {
                            role: 'system',
                            content: `Classify crop outcome after a spray recommendation. Reply JSON only: {"level":"fully_improved"|"slight_improvement"|"no_improvement"|"worse","confidence":0.0-1.0}. Farmer may write in ${langHint}. Be conservative if unclear.`,
                        },
                        {
                            role: 'user',
                            content: `Issue was: ${params.issueLabel ?? 'crop problem'}\nFarmer reply: ${snippet}${params.hasImage ? '\n[Also sent a photo]' : ''}`,
                        },
                    ],
                }),
            });
            if (!res.ok)
                return rule ? this.fromRule(rule, snippet) : null;
            const data = (await res.json());
            const raw = data.choices?.[0]?.message?.content;
            if (!raw)
                return rule ? this.fromRule(rule, snippet) : null;
            const parsed = JSON.parse(raw);
            const level = parsed.level;
            if (!['fully_improved', 'slight_improvement', 'no_improvement', 'worse'].includes(level)) {
                return rule ? this.fromRule(rule, snippet) : null;
            }
            const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0.7));
            return {
                improvementLevel: level,
                confidence,
                aiClassification: aiClassificationFromLevel(level, confidence),
                source: 'whatsapp_ai',
                rawSnippet: snippet,
            };
        }
        catch (err) {
            logger.warn({ err }, 'Outcome KPI AI interpretation failed');
            return rule ? this.fromRule(rule, snippet) : null;
        }
    },
    fromRule(rule, snippet) {
        return {
            improvementLevel: rule.level,
            confidence: rule.confidence,
            aiClassification: aiClassificationFromLevel(rule.level, rule.confidence),
            source: 'whatsapp_text',
            rawSnippet: snippet,
        };
    },
};
//# sourceMappingURL=outcome-kpi-interpretation.service.js.map