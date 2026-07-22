export type ExpertCaseNavItem = {
    id: string;
    caseCode: string;
    farmerName: string | null;
    cropType: string | null;
    priority: string | null;
    primaryIssue: string | null;
    assignmentStatus: string | null;
    bucket: 'my_work' | 'available' | 'at_risk';
};
export type ExpertCaseNavigation = {
    currentIndex: number;
    total: number;
    previousCaseId: string | null;
    nextCaseId: string | null;
    items: ExpertCaseNavItem[];
};
export declare function buildExpertCaseNavigation(params: {
    ownerEmail: string;
    caseId: string;
}): Promise<ExpertCaseNavigation>;
export declare function formatCaseListMessage(navigation: ExpertCaseNavigation, locale?: string): string;
//# sourceMappingURL=expert-case-navigation.service.d.ts.map