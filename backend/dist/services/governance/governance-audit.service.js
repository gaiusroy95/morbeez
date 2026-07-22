import { createHash } from 'node:crypto';
import { env } from '../../config/env.js';
import { supabase } from '../../lib/supabase.js';
function hashPayload(parts) {
    return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}
export const governanceAuditService = {
    enabled() {
        return env.ENFORCE_GOVERNANCE_AUDIT === true;
    },
    async append(input) {
        const { data: last } = await supabase
            .from('governance_audit_events')
            .select('sequence, event_hash')
            .order('sequence', { ascending: false })
            .limit(1)
            .maybeSingle();
        const sequence = Number(last?.sequence ?? 0) + 1;
        const previousHash = last?.event_hash ? String(last.event_hash) : null;
        const eventHash = hashPayload({
            sequence,
            previousHash,
            command: input.command,
            entityType: input.entityType,
            entityId: input.entityId ?? null,
            actorEmail: input.actorEmail ?? null,
            beforeHash: input.beforeHash ?? null,
            afterHash: input.afterHash ?? null,
            reason: input.reason ?? null,
            payload: input.payload ?? {},
        });
        const { error } = await supabase.from('governance_audit_events').insert({
            sequence,
            previous_hash: previousHash,
            event_hash: eventHash,
            actor_email: input.actorEmail ?? null,
            actor_role: input.actorRole ?? null,
            request_id: input.requestId ?? null,
            command: input.command,
            entity_type: input.entityType,
            entity_id: input.entityId ?? null,
            entity_version: input.entityVersion ?? null,
            before_hash: input.beforeHash ?? null,
            after_hash: input.afterHash ?? null,
            reason: input.reason ?? null,
            payload: input.payload ?? {},
        });
        if (error)
            throw error;
        return { sequence, eventHash };
    },
    async verifyChain(limit = 500) {
        const { data } = await supabase
            .from('governance_audit_events')
            .select('*')
            .order('sequence', { ascending: true })
            .limit(limit);
        let previousHash = null;
        let checked = 0;
        for (const row of data ?? []) {
            checked += 1;
            if ((row.previous_hash ?? null) !== previousHash) {
                return { ok: false, checked, brokenAt: Number(row.sequence) };
            }
            const expected = hashPayload({
                sequence: Number(row.sequence),
                previousHash,
                command: row.command,
                entityType: row.entity_type,
                entityId: row.entity_id ?? null,
                actorEmail: row.actor_email ?? null,
                beforeHash: row.before_hash ?? null,
                afterHash: row.after_hash ?? null,
                reason: row.reason ?? null,
                payload: row.payload ?? {},
            });
            if (expected !== row.event_hash) {
                return { ok: false, checked, brokenAt: Number(row.sequence) };
            }
            previousHash = String(row.event_hash);
        }
        return { ok: true, checked };
    },
};
//# sourceMappingURL=governance-audit.service.js.map