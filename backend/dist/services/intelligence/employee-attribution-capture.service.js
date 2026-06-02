import { supabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { employeeAttributionService } from './employee-attribution.service.js';
import { employeeProfileResolveService } from './employee-profile-resolve.service.js';
export const ATTRIBUTION_CONVERSION_WINDOW_DAYS = 180;
const CONVERSION_ELIGIBLE_TYPES = [
    'telecaller_assigned',
    'first_engagement',
    'relationship_owner',
    'advisory',
    'reactivation',
];
function isMissingTableError(err) {
    const msg = err instanceof Error ? err.message : String(err);
    return (msg.includes('employee_farmer_attribution') &&
        (msg.includes('does not exist') || msg.includes('PGRST204') || msg.includes('schema')));
}
function mapProfileRole(role) {
    const r = (role ?? '').toLowerCase();
    if (r === 'agronomist' || r === 'field_agronomist')
        return 'agronomist';
    if (r === 'telecaller' || r === 'crop_advisor')
        return 'telecaller';
    if (r === 'operations')
        return 'operations';
    if (r === 'manager' || r === 'super_admin')
        return 'manager';
    if (r === 'admin')
        return 'admin';
    return 'telecaller';
}
async function resolveStaff(employeeEmail, roleHint) {
    const profileId = await employeeProfileResolveService.resolve({
        employeeEmail: employeeEmail ?? undefined,
    });
    if (!profileId)
        return null;
    const { data } = await supabase
        .from('employee_profiles')
        .select('role')
        .eq('id', profileId)
        .maybeSingle();
    return {
        profileId,
        role: roleHint ?? mapProfileRole(data?.role ? String(data.role) : null),
    };
}
/**
 * Phase 2: fire-and-forget multi-touch attribution. Never throws to callers.
 */
export const employeeAttributionCaptureService = {
    async upsertSafe(input) {
        try {
            await employeeAttributionService.upsertTouch(input);
        }
        catch (err) {
            if (isMissingTableError(err)) {
                logger.warn('employee_farmer_attribution table missing — run migration 20260637000000_opportunity_intelligence_phase0.sql');
                return;
            }
            logger.warn({ err, farmerId: input.farmerId, type: input.attributionType }, 'Attribution capture failed');
        }
    },
    async trackTelecallerAssigned(farmerId, agentEmail) {
        const staff = await resolveStaff(agentEmail, 'telecaller');
        if (!staff)
            return;
        await this.upsertSafe({
            farmerId,
            employeeProfileId: staff.profileId,
            attributionType: 'telecaller_assigned',
            employeeRole: staff.role,
            metadata: { agentEmail: agentEmail.trim().toLowerCase() },
        });
    },
    async trackInboundEngagement(farmerId, assigneeEmail) {
        const email = assigneeEmail ??
            (await supabase.from('leads').select('assigned_to').eq('farmer_id', farmerId).maybeSingle()).data
                ?.assigned_to;
        const staff = await resolveStaff(email ? String(email) : null, 'telecaller');
        if (!staff)
            return;
        const { data: assignedRow } = await supabase
            .from('employee_farmer_attribution')
            .select('id')
            .eq('farmer_id', farmerId)
            .eq('employee_profile_id', staff.profileId)
            .eq('attribution_type', 'telecaller_assigned')
            .maybeSingle();
        if (!assignedRow) {
            await this.upsertSafe({
                farmerId,
                employeeProfileId: staff.profileId,
                attributionType: 'telecaller_assigned',
                employeeRole: staff.role,
                metadata: { inferredFromEngagement: true },
            });
        }
        await this.upsertSafe({
            farmerId,
            employeeProfileId: staff.profileId,
            attributionType: 'first_engagement',
            employeeRole: staff.role,
            metadata: { channel: 'whatsapp' },
        });
        await this.upsertSafe({
            farmerId,
            employeeProfileId: staff.profileId,
            attributionType: 'relationship_owner',
            employeeRole: staff.role,
            metadata: { channel: 'whatsapp' },
        });
    },
    async trackAdvisory(farmerId, agentEmail, metadata) {
        const staff = await resolveStaff(agentEmail, 'agronomist');
        if (!staff)
            return;
        await this.upsertSafe({
            farmerId,
            employeeProfileId: staff.profileId,
            attributionType: 'advisory',
            employeeRole: staff.role,
            metadata,
        });
    },
    async trackReactivation(farmerId, employeeEmail) {
        let email = employeeEmail;
        if (!email) {
            const { data: lastOutbound } = await supabase
                .from('interaction_logs')
                .select('content, channel')
                .eq('farmer_id', farmerId)
                .eq('direction', 'outbound')
                .in('channel', ['whatsapp', 'crm', 'call'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (lastOutbound?.channel === 'crm' && lastOutbound.content) {
                const match = String(lastOutbound.content).match(/^([^:]+):/);
                if (match?.[1]?.includes('@'))
                    email = match[1].trim();
            }
        }
        if (!email) {
            const { data: lead } = await supabase
                .from('leads')
                .select('assigned_to')
                .eq('farmer_id', farmerId)
                .maybeSingle();
            email = lead?.assigned_to ? String(lead.assigned_to) : null;
        }
        const staff = await resolveStaff(email, 'telecaller');
        if (!staff)
            return;
        await this.upsertSafe({
            farmerId,
            employeeProfileId: staff.profileId,
            attributionType: 'reactivation',
            employeeRole: staff.role,
            metadata: { inactiveDays: 30 },
        });
    },
    async trackConversionForOrder(farmerId, metadata) {
        const rows = await employeeAttributionService.listEligibleForConversion(farmerId, ATTRIBUTION_CONVERSION_WINDOW_DAYS);
        const credited = new Set();
        for (const row of rows) {
            if (!CONVERSION_ELIGIBLE_TYPES.includes(row.attributionType))
                continue;
            if (credited.has(row.employeeProfileId))
                continue;
            credited.add(row.employeeProfileId);
            await this.upsertSafe({
                farmerId,
                employeeProfileId: row.employeeProfileId,
                attributionType: 'conversion_assist',
                employeeRole: row.employeeRole,
                metadata: {
                    shopifyOrderId: metadata.shopifyOrderId,
                    orderName: metadata.orderName ?? null,
                    total: metadata.total ?? null,
                    sourceAttributionType: row.attributionType,
                },
            });
        }
    },
    /** Map recorded farmer events to attribution side-effects (Phase 0 rules). */
    async onFarmerEvent(params) {
        switch (params.eventType) {
            case 'MESSAGE_REPLY':
                await this.trackInboundEngagement(params.farmerId, params.employeeEmail ?? null);
                break;
            case 'RECOMMENDATION_APPROVED':
                if (params.employeeEmail) {
                    await this.trackAdvisory(params.farmerId, params.employeeEmail, {
                        source: 'recommendation_approved',
                    });
                }
                break;
            case 'FIELD_FINDING_LOGGED':
                if (params.employeeEmail) {
                    await this.trackAdvisory(params.farmerId, params.employeeEmail, {
                        source: params.eventType,
                    });
                }
                break;
            case 'CROP_ASSESSMENT_REQUESTED':
                if (params.employeeEmail && params.eventValue?.submittedForApproval === true) {
                    await this.trackAdvisory(params.farmerId, params.employeeEmail, {
                        source: params.eventType,
                        escalationId: params.eventValue?.escalationId ?? null,
                    });
                }
                break;
            case 'ORDER_CONVERTED':
                await this.trackConversionForOrder(params.farmerId, {
                    shopifyOrderId: String(params.eventValue?.shopifyOrderId ?? ''),
                    orderName: params.eventValue?.orderName,
                    total: params.eventValue?.total,
                });
                break;
            case 'FARMER_REACTIVATED':
                await this.trackReactivation(params.farmerId, params.employeeEmail ?? null);
                break;
            default:
                break;
        }
    },
};
//# sourceMappingURL=employee-attribution-capture.service.js.map