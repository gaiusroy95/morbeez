import { GINGER_KNOWLEDGE_V1 } from '../../domain/maios-reasoning/knowledge/ginger.v1.js';
import { BANANA_KNOWLEDGE_V1 } from '../../domain/maios-reasoning/knowledge/banana.v1.js';
import { TOMATO_KNOWLEDGE_V1 } from '../../domain/maios-reasoning/knowledge/tomato.v1.js';
import { COCONUT_KNOWLEDGE_V1 } from '../../domain/maios-reasoning/knowledge/coconut.v1.js';
import { BRINJAL_KNOWLEDGE_V1 } from '../../domain/maios-reasoning/knowledge/brinjal.v1.js';
import { DEFAULT_KNOWLEDGE_V1 } from '../../domain/maios-reasoning/knowledge/default.v1.js';
const BUILTIN = {
    ginger: GINGER_KNOWLEDGE_V1,
    banana: BANANA_KNOWLEDGE_V1,
    tomato: TOMATO_KNOWLEDGE_V1,
    coconut: COCONUT_KNOWLEDGE_V1,
    brinjal: BRINJAL_KNOWLEDGE_V1,
    _default: DEFAULT_KNOWLEDGE_V1,
};
function normalizeCrop(cropType) {
    return cropType.toLowerCase().trim().replace(/\s+/g, '_');
}
export const maiosKnowledgeService = {
    load(cropType, _pack) {
        const key = normalizeCrop(cropType);
        if (BUILTIN[key])
            return BUILTIN[key];
        if (key.includes('ginger'))
            return GINGER_KNOWLEDGE_V1;
        if (key.includes('banana'))
            return BANANA_KNOWLEDGE_V1;
        if (key.includes('tomato'))
            return TOMATO_KNOWLEDGE_V1;
        if (key.includes('coconut'))
            return COCONUT_KNOWLEDGE_V1;
        if (key.includes('brinjal') || key.includes('eggplant'))
            return BRINJAL_KNOWLEDGE_V1;
        return {
            ...DEFAULT_KNOWLEDGE_V1,
            cropType: key,
        };
    },
    listLikelihoodRatios(pkg, evidenceKey) {
        return pkg.likelihoodRatios.filter((r) => r.evidenceKey === evidenceKey);
    },
};
//# sourceMappingURL=knowledge.service.js.map