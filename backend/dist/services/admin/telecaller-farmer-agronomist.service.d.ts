type ActivityTone = 'success' | 'info' | 'purple' | 'warning' | 'review';
export declare const telecallerFarmerAgronomistService: {
    getPanel(farmerId: string): Promise<{
        agronomist: {
            name: string;
            employeeId: string;
            mobile: string;
            email: string;
            specialization: string;
            assignedSince: string;
            assignedBlocks: string;
            lastReview: string;
            nextVisit: string;
            status: string;
            statusTone: string;
            initials: string;
        };
        activities: {
            id: string;
            source: "field_finding" | "recommendation";
            at: string;
            dateLabel: string;
            activity: string;
            activityTone: ActivityTone;
            block: string;
            notes: string;
        }[];
        blocks: {
            block: string;
            crop: string;
            area: string;
            status: string;
            statusTone: string;
        }[];
        performance: {
            label: string;
            value: string;
            icon: string;
        }[];
    }>;
};
export {};
//# sourceMappingURL=telecaller-farmer-agronomist.service.d.ts.map