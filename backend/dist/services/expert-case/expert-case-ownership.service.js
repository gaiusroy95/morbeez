import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { ConflictError, NotFoundError, UnauthorizedError } from '../../lib/errors.js';
import { supabase } from '../../lib/supabase.js';
function addSeconds(seconds) {
    return new Date(Date.now() + seconds * 1000).toISOString();
}
export const expertCaseOwnershipService = {
    enabled() {
        return env.ENABLE_EXPERT_CASES === true && env.ENABLE_EXPERT_CASE_OWNERSHIP === true;
    },
    async ensureCapacity(email) {
        const normalized = email.trim().toLowerCase();
        const { data } = await supabase
            .from('expert_capacity_state')
            .select('*')
            .eq('employee_email', normalized)
            .maybeSingle();
        if (data)
            return data;
        const { data: created, error } = await supabase
            .from('expert_capacity_state')
            .insert({
            employee_profile_id: randomUUID(),
            employee_email: normalized,
            availability: 'accepting',
        })
            .select('*')
            .single();
        if (error)
            throw error;
        return created;
    },
    async claim(params) {
        if (!this.enabled()) {
            throw new UnauthorizedError('Expert case ownership is disabled');
        }
        const email = params.ownerEmail.trim().toLowerCase();
        const capacity = await this.ensureCapacity(email);
        const { data: rpcData, error: rpcError } = await supabase.rpc('expert_claim_case', {
            p_case_id: params.caseId,
            p_employee_profile_id: capacity.employee_profile_id,
            p_employee_email: email,
            p_actor_email: email,
            p_lease_minutes: Math.max(1, Math.round(env.EXPERT_CASE_LEASE_SECONDS / 60)),
        });
        if (!rpcError && rpcData) {
            const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
            return {
                caseId: String(row.id ?? params.caseId),
                leaseToken: String(row.lease_token),
                leaseExpiresAt: String(row.lease_expires_at),
            };
        }
        if (capacity.availability !== 'accepting') {
            throw new ConflictError(`Expert is ${capacity.availability}`);
        }
        if (Number(capacity.active_weight) + 1 > Number(capacity.max_active_weight)) {
            throw new ConflictError('Expert capacity exceeded');
        }
        const { data: row } = await supabase
            .from('expert_cases')
            .select('*')
            .eq('id', params.caseId)
            .maybeSingle();
        if (!row)
            throw new NotFoundError('Expert case not found');
        if (row.review_flag !== 'open' || row.merged_into_case_id) {
            throw new ConflictError('Case is not claimable');
        }
        const leaseActive = row.owner_email &&
            row.lease_expires_at &&
            new Date(String(row.lease_expires_at)).getTime() > Date.now();
        if (leaseActive && String(row.owner_email).toLowerCase() !== email) {
            throw new ConflictError('Case already owned by another expert');
        }
        const leaseToken = randomUUID();
        const leaseExpiresAt = addSeconds(env.EXPERT_CASE_LEASE_SECONDS);
        const nextVersion = Number(row.queue_version ?? 0) + 1;
        const { data: updated, error } = await supabase
            .from('expert_cases')
            .update({
            owner_email: email,
            owner_employee_id: capacity.employee_profile_id,
            lease_token: leaseToken,
            lease_expires_at: leaseExpiresAt,
            last_heartbeat_at: new Date().toISOString(),
            assignment_status: 'accepted',
            status: 'under_review',
            assigned_at: row.assigned_at ?? new Date().toISOString(),
            first_assigned_at: row.first_assigned_at ?? new Date().toISOString(),
            accepted_at: new Date().toISOString(),
            queue_version: nextVersion,
            updated_at: new Date().toISOString(),
        })
            .eq('id', params.caseId)
            .eq('queue_version', row.queue_version)
            .select('id')
            .maybeSingle();
        if (error)
            throw error;
        if (!updated)
            throw new ConflictError('Case claim lost a race — retry');
        await supabase.from('expert_case_ownership_events').insert({
            case_id: params.caseId,
            event_type: 'claimed',
            to_owner_email: email,
            lease_token: leaseToken,
            reason: params.reason ?? 'claim',
            actor_email: email,
        });
        await supabase.from('expert_assignment_events').insert({
            case_id: params.caseId,
            assignment_version: nextVersion,
            event_type: 'accepted',
            to_owner_email: email,
            actor_type: 'expert',
            actor_id: email,
            reason_text: params.reason ?? 'claim',
            idempotency_key: `claim:${params.caseId}:${nextVersion}`,
        });
        if (!leaseActive || String(row.owner_email).toLowerCase() !== email) {
            await supabase
                .from('expert_capacity_state')
                .update({
                active_case_count: Number(capacity.active_case_count) + 1,
                active_weight: Number(capacity.active_weight) + Number(row.queue_weight ?? 1),
                last_assigned_at: new Date().toISOString(),
                version: Number(capacity.version) + 1,
                updated_at: new Date().toISOString(),
            })
                .eq('employee_email', email);
        }
        await supabase.from('staff_notifications').upsert({
            recipient_email: email,
            category: 'assignment',
            title: 'Case claimed',
            body: `You now own expert case ${params.caseId}`,
            case_id: params.caseId,
            deep_link: `/case/${params.caseId}`,
            dedupe_key: `case:${params.caseId}:assignment:${nextVersion}:claimed`,
        }, { onConflict: 'dedupe_key' });
        return { caseId: params.caseId, leaseToken, leaseExpiresAt };
    },
    async renewLease(params) {
        const email = params.ownerEmail.trim().toLowerCase();
        const capacity = await this.ensureCapacity(email);
        const { data: rpcData, error: rpcError } = await supabase.rpc('expert_heartbeat_case', {
            p_case_id: params.caseId,
            p_employee_profile_id: capacity.employee_profile_id,
            p_lease_token: params.leaseToken,
            p_extend_minutes: Math.max(1, Math.round(env.EXPERT_CASE_LEASE_SECONDS / 60)),
        });
        if (!rpcError && rpcData) {
            const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
            return { leaseExpiresAt: String(row.lease_expires_at) };
        }
        const leaseExpiresAt = addSeconds(env.EXPERT_CASE_LEASE_SECONDS);
        const { data, error } = await supabase
            .from('expert_cases')
            .update({
            lease_expires_at: leaseExpiresAt,
            last_heartbeat_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
            .eq('id', params.caseId)
            .eq('owner_email', email)
            .eq('lease_token', params.leaseToken)
            .select('id')
            .maybeSingle();
        if (error)
            throw error;
        if (!data)
            throw new ConflictError('Lease renew failed — ownership changed');
        await supabase.from('expert_case_ownership_events').insert({
            case_id: params.caseId,
            event_type: 'renewed',
            to_owner_email: email,
            lease_token: params.leaseToken,
            actor_email: email,
        });
        return { leaseExpiresAt };
    },
    async release(params) {
        const email = params.ownerEmail.trim().toLowerCase();
        const capacity = await this.ensureCapacity(email);
        const { data: rpcData, error: rpcError } = await supabase.rpc('expert_release_case', {
            p_case_id: params.caseId,
            p_employee_profile_id: capacity.employee_profile_id,
            p_lease_token: params.leaseToken ?? null,
            p_actor_email: email,
            p_reason: params.reason ?? 'release',
            p_requeue_delay_seconds: 0,
        });
        if (!rpcError && rpcData != null)
            return;
        const { data: row } = await supabase
            .from('expert_cases')
            .select('*')
            .eq('id', params.caseId)
            .maybeSingle();
        if (!row)
            throw new NotFoundError('Expert case not found');
        if (String(row.owner_email ?? '').toLowerCase() !== email) {
            throw new ConflictError('Only the owner can release this case');
        }
        const interruptionCount = Number(row.interruption_count ?? 0) + (params.countInterruption ? 1 : 0);
        const intervention = params.countInterruption && interruptionCount >= env.EXPERT_CASE_INTERRUPTION_LIMIT;
        await supabase
            .from('expert_cases')
            .update({
            owner_email: null,
            owner_employee_id: null,
            lease_token: null,
            lease_expires_at: null,
            assignment_status: intervention ? 'intervention_required' : 'queued',
            status: intervention ? 'awaiting_capacity' : 'intake',
            interruption_count: interruptionCount,
            last_interruption_reason: params.reason ?? null,
            manual_intervention_at: intervention ? new Date().toISOString() : row.manual_intervention_at,
            requeue_count: Number(row.requeue_count ?? 0) + 1,
            queue_version: Number(row.queue_version ?? 0) + 1,
            updated_at: new Date().toISOString(),
        })
            .eq('id', params.caseId);
        await supabase.from('expert_case_ownership_events').insert({
            case_id: params.caseId,
            event_type: intervention ? 'senior_escalated' : 'released',
            from_owner_email: email,
            reason: params.reason ?? 'release',
            actor_email: email,
            payload: { interruptionCount, intervention },
        });
        await supabase
            .from('expert_capacity_state')
            .update({
            active_case_count: Math.max(0, Number(capacity.active_case_count) - 1),
            active_weight: Math.max(0, Number(capacity.active_weight) - Number(row.queue_weight ?? 1)),
            version: Number(capacity.version) + 1,
            updated_at: new Date().toISOString(),
        })
            .eq('employee_email', email);
    },
    async reaperExpiredLeases(limit = 20) {
        if (!env.ENABLE_EXPERT_COPILOT_LEASE_REAPER)
            return 0;
        const { data: rpcData, error: rpcError } = await supabase.rpc('expert_reap_expired_leases', {
            p_actor_email: 'system:lease-reaper',
            p_limit: limit,
        });
        if (!rpcError && rpcData != null) {
            return Array.isArray(rpcData) ? rpcData.length : Number(rpcData);
        }
        const { data } = await supabase
            .from('expert_cases')
            .select('id, owner_email, lease_token')
            .eq('review_flag', 'open')
            .not('owner_email', 'is', null)
            .lt('lease_expires_at', new Date().toISOString())
            .limit(limit);
        let count = 0;
        for (const row of data ?? []) {
            if (!row.owner_email)
                continue;
            await this.release({
                caseId: String(row.id),
                ownerEmail: String(row.owner_email),
                leaseToken: row.lease_token ? String(row.lease_token) : null,
                reason: 'lease_expired',
                countInterruption: true,
            });
            count += 1;
        }
        return count;
    },
    async setAvailability(params) {
        const capacity = await this.ensureCapacity(params.email);
        await supabase
            .from('expert_capacity_state')
            .update({
            availability: params.availability,
            pause_reason: params.reason ?? null,
            paused_at: params.availability === 'paused' ? new Date().toISOString() : null,
            paused_until: params.pausedUntil ?? null,
            version: Number(capacity.version) + 1,
            updated_at: new Date().toISOString(),
            updated_by: params.email.trim().toLowerCase(),
        })
            .eq('employee_email', params.email.trim().toLowerCase());
    },
};
//# sourceMappingURL=expert-case-ownership.service.js.map