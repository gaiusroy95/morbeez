export type ExpertCapability = 'case.correct' | 'candidate.review' | 'knowledge.publish' | 'reuse.approve' | 'release.approve' | 'channel.promote' | 'reviewer.monitor' | 'audit.verify' | 'safety.override';
export declare const expertCapabilityService: {
    assert(actorEmail: string, capability: ExpertCapability, options?: {
        allowWhenGovernanceDisabled?: boolean;
    }): Promise<void>;
};
//# sourceMappingURL=expert-capability.service.d.ts.map