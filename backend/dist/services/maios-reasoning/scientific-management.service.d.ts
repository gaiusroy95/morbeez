import type { CropKnowledgePackage } from '../../domain/maios-reasoning/types.js';
import type { ScientificManagementPlan } from '../../domain/maios-reasoning/management-types.js';
/** Domain 8 — agronomic management from knowledge package (no product SKU mapping). */
export declare const maiosScientificManagementService: {
    build(params: {
        pkg: CropKnowledgePackage;
        diagnosisLabel: string | null;
        locked: boolean;
    }): ScientificManagementPlan | null;
};
//# sourceMappingURL=scientific-management.service.d.ts.map