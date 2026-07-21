import { soilReportLoaderService } from '../../soil/soil-report-loader.service.js';
import { visitAiContextService } from '../../core/visit-ai-context.service.js';
import { visitAiPromptContextService } from '../../core/visit-ai-prompt-context.service.js';
import { visitAiRetrievalService } from '../../core/visit-ai-retrieval.service.js';
export const whatsappDiagnosisContextService = {
    async buildFieldContext(params) {
        const blockId = params.blockId?.trim();
        if (!blockId)
            return null;
        try {
            const context = await visitAiContextService.buildVisitAiContext({
                farmerId: params.farmerId,
                blockId,
            });
            const [trainingExamples, verifiedCases] = await Promise.all([
                visitAiRetrievalService.findTrainingExamples({
                    farmerId: params.farmerId,
                    cropType: params.cropType,
                    issueName: params.issueName,
                    observation: params.observation,
                    limit: 4,
                }),
                visitAiRetrievalService.findVerifiedCases({
                    cropType: params.cropType,
                    issueName: params.issueName,
                    limit: 5,
                }),
            ]);
            const issueCategory = params.issueCategory ?? inferIssueCategory(params.issueName, params.observation);
            return visitAiPromptContextService.buildPromptBlock({
                context,
                issueCategory,
                issueName: params.issueName,
                observation: params.observation,
                trainingExamples,
                similarCases: verifiedCases,
            });
        }
        catch {
            return null;
        }
    },
    async loadSoilSummaryForBlock(farmerId, blockId) {
        const loaded = await soilReportLoaderService.loadLatestForBlock(farmerId, blockId);
        return loaded?.summaryLine ?? null;
    },
};
function inferIssueCategory(issueName, observation) {
    const blob = `${issueName} ${observation ?? ''}`.toLowerCase();
    if (/nutrient|deficien|nitrogen|potassium|phosphorus|chlorosis|yellow/.test(blob))
        return 'nutrient';
    if (/pest|thrip|mite|insect|aphid/.test(blob))
        return 'pest';
    if (/disease|fungal|rot|spot|blight|wilt/.test(blob))
        return 'disease';
    if (/water|drain|flood|logging/.test(blob))
        return 'water_stress';
    return 'other';
}
//# sourceMappingURL=whatsapp-diagnosis-context.service.js.map