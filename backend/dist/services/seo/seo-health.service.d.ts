export declare const seoHealthService: {
    list(opts?: {
        resolved?: boolean;
        issueType?: string;
    }): Promise<any[]>;
    resolve(id: string): Promise<any>;
    runScan(): Promise<{
        scannedProducts: number;
        scannedPages: number;
        issuesFound: number;
        issues: Record<string, unknown>[];
    }>;
};
//# sourceMappingURL=seo-health.service.d.ts.map