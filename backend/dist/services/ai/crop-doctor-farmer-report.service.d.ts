import type { MaiosReasoningSnapshot } from '../../domain/maios-reasoning/types.js';
import type { CropDoctorReportContext } from './crop-doctor-report-context.service.js';
import type { StructuredAdvisory } from './types.js';
export type { CropDoctorReportContext };
declare function buildFarmerReport(advisory: StructuredAdvisory, ctx: CropDoctorReportContext): string;
declare function buildTechnicalReport(advisory: StructuredAdvisory, reasoning?: MaiosReasoningSnapshot | null): string;
export declare const cropDoctorFarmerReportService: {
    buildFarmerReport: typeof buildFarmerReport;
    buildTechnicalReport: typeof buildTechnicalReport;
    attachReports(advisory: StructuredAdvisory, ctx: CropDoctorReportContext): StructuredAdvisory;
};
//# sourceMappingURL=crop-doctor-farmer-report.service.d.ts.map