import { env } from '../../config/env.js';
import { UnauthorizedError } from '../../lib/errors.js';
import { supabase } from '../../lib/supabase.js';
/** Map app capability names onto governance_actor_capabilities rows. */
const CAPABILITY_ALIASES = {
    'case.correct': ['case.correct', 'case_correction'],
    'candidate.review': ['candidate.review', 'secondary_review'],
    'knowledge.publish': ['knowledge.publish', 'publication'],
    'reuse.approve': ['reuse.approve', 'reuse_approval'],
    'release.approve': ['release.approve', 'release_approval'],
    'channel.promote': ['channel.promote', 'channel_promotion'],
    'reviewer.monitor': ['reviewer.monitor', 'reviewer_monitoring'],
    'audit.verify': ['audit.verify', 'audit_verification'],
    'safety.override': ['safety.override', 'safety_override'],
};
export const expertCapabilityService = {
    async assert(actorEmail, capability, options) {
        if (!env.ENFORCE_GOVERNANCE_AUDIT && options?.allowWhenGovernanceDisabled !== false) {
            return;
        }
        const email = actorEmail.trim().toLowerCase();
        const aliases = CAPABILITY_ALIASES[capability];
        const { data, error } = await supabase
            .from('governance_actor_capabilities')
            .select('id')
            .eq('actor_key', email)
            .in('capability', aliases)
            .eq('active', true)
            .or(`valid_until.is.null,valid_until.gt.${new Date().toISOString()}`)
            .limit(1)
            .maybeSingle();
        if (error || !data) {
            throw new UnauthorizedError(`Missing capability: ${capability}`);
        }
    },
};
//# sourceMappingURL=expert-capability.service.js.map