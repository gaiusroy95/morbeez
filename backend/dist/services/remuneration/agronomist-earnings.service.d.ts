import { type AgronomistEventType } from '../../domain/remuneration/agronomist-pay.js';
type CreditInput = {
    agronomistEmail: string;
    farmerId?: string | null;
    eventType: AgronomistEventType;
    sourceId: string;
    km?: number | null;
    notes?: string;
    amountInr?: number;
};
export declare const agronomistEarningsService: {
    resolveEmployeeId(email: string): Promise<string | null>;
    credit(input: CreditInput): Promise<{
        id: string;
        amountInr: number;
    } | null>;
    creditVisitCheckout(session: {
        id: string;
        agronomist_email: string;
        farmer_id: string;
        field_finding_id?: string | null;
        check_in_lat?: number | null;
        check_in_lng?: number | null;
        check_out_lat?: number | null;
        check_out_lng?: number | null;
    }): Promise<void>;
    monthTotals(employeeProfileId: string, period: string): Promise<{
        visitBonus: number;
        recBonus: number;
        escalationBonus: number;
        retentionBonus: number;
        kmInr: number;
        kmTotal: number;
        bonusTotal: number;
        salesIncentive: number;
        eventCount: number;
    }>;
    markIncludedInPayroll(employeeProfileId: string, period: string, payrollEntryId: string): Promise<void>;
    listForEmployee(employeeProfileId: string, limit?: number): Promise<{
        id: any;
        event_type: any;
        amount_inr: any;
        km: any;
        status: any;
        period_month: any;
        notes: any;
        created_at: any;
        source_id: any;
    }[]>;
};
export {};
//# sourceMappingURL=agronomist-earnings.service.d.ts.map