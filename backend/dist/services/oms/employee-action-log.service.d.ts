export declare const employeeActionLogService: {
    log(input: {
        actorEmail: string;
        actionType: string;
        entityType: string;
        entityId?: string;
        details?: Record<string, unknown>;
    }): Promise<void>;
    listForEntity(entityType: string, entityId: string, limit?: number): Promise<any[]>;
};
//# sourceMappingURL=employee-action-log.service.d.ts.map