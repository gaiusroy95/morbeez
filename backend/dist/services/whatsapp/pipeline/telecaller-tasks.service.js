import { supabase } from '../../../lib/supabase.js';
import { leadService } from '../../crm/lead.service.js';
import { farmerHealthScoreService } from './farmer-health-score.service.js';
export async function createTelecallerTask(params) {
    const dueAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    let effectivePriority = params.priority ?? 'normal';
    let boostReason = '';
    if (effectivePriority === 'normal') {
        try {
            const { data: retention } = await supabase
                .from('farmer_retention_tracking')
                .select('risk_band')
                .eq('farmer_id', params.farmerId)
                .maybeSingle();
            if (retention?.risk_band === 'churned') {
                effectivePriority = 'urgent';
                boostReason = 'retention churned';
            }
            else if (retention?.risk_band === 'at_risk') {
                effectivePriority = 'high';
                boostReason = 'retention at_risk';
            }
        }
        catch {
            /* non-blocking */
        }
    }
    if (effectivePriority === 'normal') {
        try {
            const health = await farmerHealthScoreService.compute(params.farmerId);
            if (farmerHealthScoreService.telecallerPriorityFromHealth(health.band) === 'high') {
                effectivePriority = 'high';
                boostReason = 'farmer health at_risk';
            }
        }
        catch {
            /* non-blocking */
        }
    }
    const healthNote = boostReason && effectivePriority !== (params.priority ?? 'normal')
        ? ` [priority boosted: ${boostReason}]`
        : '';
    await supabase.from('crm_tasks').insert({
        farmer_id: params.farmerId,
        lead_id: params.leadId ?? null,
        task_type: 'follow_up',
        title: params.title,
        notes: params.notes ? `${params.notes}${healthNote}` : healthNote.trim() || null,
        due_at: dueAt,
        status: 'pending',
    });
    if (effectivePriority === 'urgent' || effectivePriority === 'high') {
        await leadService.ensureLeadForFarmer({
            farmerId: params.farmerId,
            intent: 'callback',
            source: 'whatsapp_escalation',
            status: 'new',
            priority: effectivePriority,
            stage: 'follow_up',
            notes: params.notes?.slice(0, 500) ?? params.title,
            mergeNotes: true,
        });
    }
}
//# sourceMappingURL=telecaller-tasks.service.js.map