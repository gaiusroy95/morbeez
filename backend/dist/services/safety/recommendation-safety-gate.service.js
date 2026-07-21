import { createHash } from 'node:crypto';
import { env } from '../../config/env.js';
import { ConflictError, UnauthorizedError } from '../../lib/errors.js';
import { supabase } from '../../lib/supabase.js';
import { validateVisitAssistantRecommendations, } from '../agronomist/visit-assistant-recommendation-safety.service.js';
const POLICY_VERSION = 'domain4-v1';
function contentHash(value) {
    return createHash('sha256').update(JSON.stringify(value ?? {})).digest('hex');
}
export const recommendationSafetyGateService = {
    enforced() {
        return env.ENFORCE_SERVER_RECOMMENDATION_SAFETY === true;
    },
    async evaluate(input) {
        const snapshot = {
            validation: input.validation,
            unstructured: input.unstructured ?? null,
            recommendationRevision: input.recommendationRevision,
        };
        const hash = contentHash(snapshot);
        let decision = 'PASS';
        let blockers = [];
        let warnings = [];
        let compatibilityReport = null;
        let maiosReport = null;
        if (input.validation.recommendationGroups?.length) {
            const result = await validateVisitAssistantRecommendations(input.validation);
            blockers = result.blockers;
            warnings = result.warnings;
            compatibilityReport = result.compatibilityReport;
            maiosReport = result.safetyReport;
            if (!result.ok || result.blockers.some((b) => b.code === 'maios_safety_reject' || b.code === 'incompatible_materials')) {
                decision = 'REJECT';
            }
            else if (result.unresolvedFields.length > 0 || !result.ok) {
                decision = 'UNRESOLVED';
            }
            else {
                decision = 'PASS';
            }
        }
        else if (input.unstructured) {
            const text = String(input.unstructured.recommendationText ?? '').trim();
            const dosage = String(input.unstructured.dosage ?? '').trim();
            const applicationType = String(input.unstructured.applicationType ?? '').trim();
            if (!text) {
                blockers = [{ code: 'missing_recommendation', message: 'Recommendation text is required' }];
                decision = 'UNRESOLVED';
            }
            else if (!dosage) {
                warnings = [{ code: 'missing_dosage', message: 'Dosage is incomplete' }];
                blockers = [{ code: 'missing_dosage', message: 'Dosage is required for approval' }];
                decision = 'UNRESOLVED';
            }
            else if (!applicationType) {
                blockers = [
                    {
                        code: 'missing_application_mode',
                        message: 'Application mode is required for treatment approval',
                    },
                ];
                decision = 'UNRESOLVED';
            }
            else {
                decision = 'PASS';
            }
        }
        else {
            decision = 'UNRESOLVED';
            blockers = [{ code: 'empty_recommendation', message: 'No recommendation content to evaluate' }];
        }
        const { data, error } = await supabase
            .from('safety_gate_decisions')
            .insert({
            aggregate_type: input.aggregateType,
            aggregate_id: input.aggregateId,
            case_id: input.caseId ?? null,
            recommendation_revision: input.recommendationRevision,
            content_hash: hash,
            policy_version: input.policyVersion ?? POLICY_VERSION,
            decision,
            blockers,
            warnings,
            compatibility_report: compatibilityReport,
            maios_report: maiosReport,
            input_snapshot: snapshot,
            confirmed_by: input.actorEmail ?? null,
        })
            .select('id, decision')
            .single();
        if (error)
            throw error;
        const finalDecision = data.decision;
        return {
            decisionId: String(data.id),
            decision: finalDecision,
            contentHash: hash,
            blockers,
            warnings,
            allowsApproval: finalDecision === 'PASS' || finalDecision === 'OVERRIDDEN',
            allowsFarmerCommunication: finalDecision === 'PASS' || finalDecision === 'OVERRIDDEN',
            allowsEvidenceSave: true,
        };
    },
    async assertAllowsApproval(params) {
        if (!this.enforced())
            return null;
        const { data } = await supabase
            .from('safety_gate_decisions')
            .select('*')
            .eq('aggregate_type', params.aggregateType)
            .eq('aggregate_id', params.aggregateId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (!data) {
            throw new ConflictError('safety_gate_required');
        }
        if (params.contentHash && data.content_hash !== params.contentHash) {
            throw new ConflictError('safety_gate_stale_content');
        }
        if (data.decision !== 'PASS' && data.decision !== 'OVERRIDDEN') {
            throw new ConflictError(`safety_gate_${String(data.decision).toLowerCase()}`);
        }
        return {
            decisionId: String(data.id),
            decision: data.decision,
            contentHash: String(data.content_hash),
            blockers: data.blockers ?? [],
            warnings: data.warnings ?? [],
            allowsApproval: true,
            allowsFarmerCommunication: true,
            allowsEvidenceSave: true,
        };
    },
    async override(params) {
        if (!params.capabilityGranted) {
            throw new UnauthorizedError('Missing safety override capability');
        }
        if (!params.reason.trim()) {
            throw new ConflictError('override_reason_required');
        }
        const { data: existing } = await supabase
            .from('safety_gate_decisions')
            .select('*')
            .eq('id', params.decisionId)
            .maybeSingle();
        if (!existing)
            throw new ConflictError('safety_decision_not_found');
        const { data, error } = await supabase
            .from('safety_gate_decisions')
            .insert({
            aggregate_type: existing.aggregate_type,
            aggregate_id: existing.aggregate_id,
            case_id: existing.case_id,
            recommendation_revision: existing.recommendation_revision,
            content_hash: existing.content_hash,
            policy_version: existing.policy_version,
            decision: 'OVERRIDDEN',
            blockers: existing.blockers,
            warnings: existing.warnings,
            compatibility_report: existing.compatibility_report,
            maios_report: existing.maios_report,
            input_snapshot: existing.input_snapshot,
            confirmed_by: params.overrideBy,
            override_reason: params.reason,
            override_by: params.overrideBy,
        })
            .select('id, decision, content_hash, blockers, warnings')
            .single();
        if (error)
            throw error;
        return {
            decisionId: String(data.id),
            decision: 'OVERRIDDEN',
            contentHash: String(data.content_hash),
            blockers: data.blockers ?? [],
            warnings: data.warnings ?? [],
            allowsApproval: true,
            allowsFarmerCommunication: true,
            allowsEvidenceSave: true,
        };
    },
};
//# sourceMappingURL=recommendation-safety-gate.service.js.map