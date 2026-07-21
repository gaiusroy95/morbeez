import { createHash, randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { ConflictError, UnauthorizedError } from '../../lib/errors.js';
import { supabase } from '../../lib/supabase.js';
import { governanceAuditService } from '../governance/governance-audit.service.js';
import { reviewerRiskService } from '../governance/reviewer-risk.service.js';
function sha(value) {
    return createHash('sha256').update(JSON.stringify(value ?? {})).digest('hex');
}
export const learningGovernanceService = {
    shadowEnabled() {
        return env.ENABLE_LEARNING_CANDIDATE_SHADOW === true;
    },
    legacyPromotionDisabled() {
        return env.DISABLE_LEGACY_AUTO_PROMOTION === true;
    },
    approvedReuseReadsEnabled() {
        return env.ENABLE_APPROVED_REUSE_MEMORY_READ === true;
    },
    async recordEvidence(params) {
        const id = randomUUID();
        const payload = params.payload ?? {};
        await supabase.from('learning_evidence_events').insert({
            id,
            event_type: params.eventType,
            source_surface: params.sourceSurface,
            aggregate_type: params.aggregateType,
            aggregate_id: params.aggregateId,
            actor_email: params.actorEmail ?? null,
            farmer_id: params.farmerId ?? null,
            case_id: params.caseId ?? null,
            payload,
            idempotency_key: params.idempotencyKey ?? null,
            payload_sha256: sha(payload),
        });
        return id;
    },
    async submitCandidate(input) {
        const dedupeKey = `${input.candidateType}:${input.claimKey}:${sha(input.payload).slice(0, 16)}`;
        const { data: existing } = await supabase
            .from('knowledge_candidates')
            .select('id, status')
            .eq('dedupe_key', dedupeKey)
            .in('status', ['submitted', 'needs_evidence'])
            .maybeSingle();
        if (existing)
            return { id: String(existing.id), status: String(existing.status) };
        const { data, error } = await supabase
            .from('knowledge_candidates')
            .insert({
            candidate_type: input.candidateType,
            claim_key: input.claimKey,
            scope: input.scope ?? 'regional',
            payload: input.payload,
            source_event_ids: input.sourceEventIds ?? [],
            case_id: input.caseId ?? null,
            proposed_by: input.proposedBy.trim().toLowerCase(),
            risk_class: input.riskClass ?? 'standard',
            dedupe_key: dedupeKey,
            status: 'submitted',
        })
            .select('id, status')
            .single();
        if (error)
            throw error;
        return { id: String(data.id), status: String(data.status) };
    },
    async reviewCandidate(params) {
        const reviewer = params.reviewerEmail.trim().toLowerCase();
        const { expertCapabilityService } = await import('../governance/expert-capability.service.js');
        await expertCapabilityService.assert(reviewer, 'candidate.review');
        await reviewerRiskService.assertCanApprove(reviewer);
        const { data: candidate } = await supabase
            .from('knowledge_candidates')
            .select('*')
            .eq('id', params.candidateId)
            .maybeSingle();
        if (!candidate)
            throw new ConflictError('candidate_not_found');
        if (String(candidate.proposed_by).toLowerCase() === reviewer) {
            await reviewerRiskService.recordSignal({
                reviewerEmail: reviewer,
                signalType: 'self_review',
                severity: 'high',
                detail: { candidateId: params.candidateId },
            });
            throw new UnauthorizedError('Proposer cannot review their own candidate');
        }
        await supabase.from('knowledge_candidate_reviews').upsert({
            candidate_id: params.candidateId,
            stage: 'secondary',
            verdict: params.verdict,
            reviewer_email: reviewer,
            reason_codes: params.reasonCodes ?? [],
            notes: params.notes ?? null,
        }, { onConflict: 'candidate_id,stage,reviewer_email' });
        let status = params.verdict === 'approve'
            ? 'accepted'
            : params.verdict === 'reject'
                ? 'rejected'
                : 'needs_evidence';
        await supabase
            .from('knowledge_candidates')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', params.candidateId);
        let knowledgeVersionId = null;
        if (params.verdict === 'approve') {
            knowledgeVersionId = await this.publishApprovedCandidate({
                candidate,
                reviewerEmail: reviewer,
            });
        }
        if (env.ENFORCE_GOVERNANCE_AUDIT) {
            await governanceAuditService.append({
                actorEmail: reviewer,
                actorRole: 'secondary_reviewer',
                command: `knowledge_candidate_${params.verdict}`,
                entityType: 'knowledge_candidate',
                entityId: params.candidateId,
                reason: params.notes ?? params.verdict,
                payload: { status, knowledgeVersionId },
            });
        }
        await reviewerRiskService.observeReview({
            reviewerEmail: reviewer,
            verdict: params.verdict,
            candidateId: params.candidateId,
        });
        return { candidateId: params.candidateId, status, knowledgeVersionId };
    },
    async publishApprovedCandidate(params) {
        const claimKey = String(params.candidate.claim_key);
        const kind = String(params.candidate.candidate_type);
        let knowledgeId;
        const { data: existing } = await supabase
            .from('knowledge_records')
            .select('id')
            .eq('knowledge_kind', kind)
            .eq('claim_key', claimKey)
            .maybeSingle();
        if (existing) {
            knowledgeId = String(existing.id);
        }
        else {
            const { data: created, error } = await supabase
                .from('knowledge_records')
                .insert({ knowledge_kind: kind, claim_key: claimKey })
                .select('id')
                .single();
            if (error)
                throw error;
            knowledgeId = String(created.id);
        }
        const { data: lastVersion } = await supabase
            .from('knowledge_versions')
            .select('version_number')
            .eq('knowledge_id', knowledgeId)
            .order('version_number', { ascending: false })
            .limit(1)
            .maybeSingle();
        const versionNumber = Number(lastVersion?.version_number ?? 0) + 1;
        const payload = params.candidate.payload ?? {};
        const contentHash = sha(payload);
        const { data: version, error: vErr } = await supabase
            .from('knowledge_versions')
            .insert({
            knowledge_id: knowledgeId,
            version_number: versionNumber,
            payload,
            content_hash: contentHash,
            source_candidate_id: params.candidate.id,
            authored_by: params.reviewerEmail,
        })
            .select('id')
            .single();
        if (vErr)
            throw vErr;
        const { data: publication, error: pErr } = await supabase
            .from('knowledge_publications')
            .upsert({
            knowledge_id: knowledgeId,
            channel: 'governed',
            scope: String(params.candidate.scope ?? 'regional'),
            active_version_id: version.id,
            status: 'active',
            updated_at: new Date().toISOString(),
        }, { onConflict: 'knowledge_id,channel,scope' })
            .select('id')
            .single();
        if (pErr)
            throw pErr;
        await supabase.from('knowledge_publication_events').insert({
            publication_id: publication.id,
            event_type: 'publish',
            to_version_id: version.id,
            actor_email: params.reviewerEmail,
            reason: 'independent_review_approved',
        });
        const payloadObj = payload;
        await supabase.from('reuse_memory_index').insert({
            publication_id: publication.id,
            approved_version_id: version.id,
            crop_type: payloadObj.cropType ?? null,
            district: payloadObj.district ?? null,
            dap_bucket: null,
            symptom_key: payloadObj.symptomKey ?? payloadObj.diagnosis ?? claimKey,
            payload,
            staff_verified: true,
            disabled: false,
        });
        return String(version.id);
    },
    async findApprovedReuse(params) {
        if (!this.approvedReuseReadsEnabled())
            return null;
        let q = supabase
            .from('reuse_memory_index')
            .select('*')
            .eq('symptom_key', params.symptomKey)
            .eq('disabled', false)
            .not('approved_version_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1);
        if (params.cropType)
            q = q.eq('crop_type', params.cropType.toLowerCase());
        if (params.district)
            q = q.eq('district', params.district.toLowerCase());
        const { data } = await q.maybeSingle();
        return data ?? null;
    },
};
//# sourceMappingURL=learning-governance.service.js.map