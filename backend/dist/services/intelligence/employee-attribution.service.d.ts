import { type EmployeeFarmerAttributionRow, type UpsertAttributionInput } from './employee-attribution.types.js';
/**
 * Phase 0: upsert multi-touch attribution rows.
 * Phase 2: invoked via employeeAttributionCaptureService from CRM, WhatsApp, agronomist, orders.
 */
export declare const employeeAttributionService: {
    upsertTouch(input: UpsertAttributionInput): Promise<EmployeeFarmerAttributionRow>;
    listForFarmer(farmerId: string, activeOnly?: boolean): Promise<EmployeeFarmerAttributionRow[]>;
    /** Active touches within conversion window (excludes conversion_assist rows). */
    listEligibleForConversion(farmerId: string, windowDays?: number): Promise<EmployeeFarmerAttributionRow[]>;
    listForEmployee(employeeProfileId: string, activeOnly?: boolean): Promise<EmployeeFarmerAttributionRow[]>;
};
//# sourceMappingURL=employee-attribution.service.d.ts.map