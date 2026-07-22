export declare const seoDashboardService: {
    getDashboard(): Promise<{
        indexedPages: any;
        topRankingPages: any;
        lowCtrPages: any;
        missingSeoCount: number;
        brokenLinksCount: number;
        trafficByKeyword: {
            keyword: any;
            clicks: any;
            impressions: any;
            position: any;
        }[];
        topProductTraffic: {
            id: string;
            title: string;
            handle: string;
            score: number;
        }[];
        schemaErrorsCount: number;
        openHealthIssues: number;
        contentPageCount: number;
        publishedPageCount: number;
        cropProblemCount: number;
        regionalHighlights: any[];
        gscLastSync: any;
        gscTotals: {
            clicks: any;
            impressions: any;
            avgCtr: any;
            avgPosition: any;
        } | null;
    }>;
};
//# sourceMappingURL=seo-dashboard.service.d.ts.map