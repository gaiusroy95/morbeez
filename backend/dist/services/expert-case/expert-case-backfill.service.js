import { logger } from '../../lib/logger.js';
import { supabase } from '../../lib/supabase.js';
import { expertCaseLifecycleService } from './expert-case-lifecycle.service.js';
/**
 * Shadow backfill: link open escalations into expert_cases without changing
 * legacy queue behavior. Safe to re-run (idempotent per escalation link).
 */
export const expertCaseBackfillService = {
    async backfillOpenEscalations(limit = 200) {
        if (!expertCaseLifecycleService.enabled()) {
            return { scanned: 0, created: 0, merged: 0, skipped: 0, errors: 0 };
        }
        const { data: rows, error } = await supabase
            .from('agronomist_escalations')
            .select('id, farmer_id, reason, confidence_at_escalation, priority, status, expert_case_id, session_id')
            .in('status', ['pending', 'in_progress', 'open'])
            .order('created_at', { ascending: true })
            .limit(limit);
        if (error)
            throw error;
        let created = 0;
        let merged = 0;
        let skipped = 0;
        let errors = 0;
        for (const row of rows ?? []) {
            if (row.expert_case_id) {
                skipped += 1;
                continue;
            }
            try {
                const result = await expertCaseLifecycleService.ensureFromAdvisory({
                    farmerId: String(row.farmer_id),
                    sessionId: row.session_id ? String(row.session_id) : null,
                    escalationId: String(row.id),
                    reason: row.reason ? String(row.reason) : null,
                    issueLabel: row.reason ? String(row.reason) : null,
                    priority: row.priority ? String(row.priority) : 'normal',
                    confidence: row.confidence_at_escalation != null ? Number(row.confidence_at_escalation) : null,
                    source: 'advisory_session',
                    actorEmail: 'backfill',
                });
                if (!result) {
                    skipped += 1;
                    continue;
                }
                if (result.created)
                    created += 1;
                else if (result.merged)
                    merged += 1;
                else
                    skipped += 1;
            }
            catch (err) {
                errors += 1;
                logger.warn({ err, escalationId: row.id }, 'Expert case backfill row failed');
            }
        }
        return {
            scanned: rows?.length ?? 0,
            created,
            merged,
            skipped,
            errors,
        };
    },
    async reconcileLinkedEscalations(limit = 500) {
        if (!expertCaseLifecycleService.enabled())
            return { checked: 0, repaired: 0 };
        const { data: links } = await supabase
            .from('expert_case_links')
            .select('case_id, entity_id')
            .eq('link_type', 'escalation')
            .limit(limit);
        let repaired = 0;
        for (const link of links ?? []) {
            const { data: esc } = await supabase
                .from('agronomist_escalations')
                .select('id, expert_case_id')
                .eq('id', link.entity_id)
                .maybeSingle();
            if (!esc)
                continue;
            if (esc.expert_case_id === link.case_id)
                continue;
            await supabase
                .from('agronomist_escalations')
                .update({
                expert_case_id: link.case_id,
                expert_link_role: esc.expert_case_id ? 'reconciled' : 'primary_ingress',
            })
                .eq('id', esc.id);
            repaired += 1;
        }
        return { checked: links?.length ?? 0, repaired };
    },
};
//# sourceMappingURL=expert-case-backfill.service.js.map