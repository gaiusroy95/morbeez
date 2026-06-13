export declare const partnerTrainingService: {
    onboardingStages: readonly ["application", "screening", "interview", "training", "certification", "trial", "active"];
    listModules(): Promise<any[]>;
    getProgress(partnerId: string): Promise<any[]>;
    recordModuleComplete(partnerId: string, moduleId: string): Promise<any>;
    listCertificationAttempts(partnerId: string): Promise<any[]>;
    recordCertificationAttempt(partnerId: string, score: number, passed: boolean): Promise<any>;
};
//# sourceMappingURL=partner-training.service.d.ts.map