import { terminologyDictionaryService } from './terminology-dictionary.service.js';
/**
 * Stage 7 — inject regional terminology into AI prompts (language memory).
 */
export const terminologyAiContextService = {
    async buildPromptBlock(params) {
        const lines = [];
        if (params.detection?.glossaryLines.length) {
            lines.push('Farmer message regional terms (this message):');
            lines.push(...params.detection.glossaryLines.slice(0, params.maxLines ?? 12));
            if (params.detection.hasUnknown) {
                lines.push(`Unknown local terms (do not guess): ${params.detection.unknownTerms.map((u) => u.token).join(', ')}`);
            }
        }
        const dict = await terminologyDictionaryService.listForContext({
            language: params.language,
            cropType: params.cropType,
            district: params.district,
            limit: 15,
        });
        if (dict.length) {
            lines.push('Regional terminology dictionary (approved):');
            for (const e of dict.slice(0, params.maxLines ?? 15)) {
                const std = e.standardTerm ? ` → ${e.standardTerm}` : '';
                lines.push(`- ${e.term}${std}: ${e.meaning}`);
            }
        }
        if (!lines.length)
            return '';
        return lines.join('\n');
    },
    /** AI reasons in standard terms; farmer text expansion for internal use. */
    expandedSymptomsText(detection, fallback) {
        if (!detection?.knownTerms.length)
            return fallback;
        return detection.expandedForAi || fallback;
    },
};
//# sourceMappingURL=terminology-ai-context.service.js.map