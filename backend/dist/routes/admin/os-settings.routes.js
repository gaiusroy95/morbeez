import { z } from 'zod';
import { assertModuleAccess, assertCanAssignRole } from '../../lib/rbac.js';
import { CONSOLE_ROLES } from '../../lib/console-roles.js';
import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { logAdminMutation } from '../../lib/admin-mutation-audit.js';
import { assertSuperAdminDeactivationAllowed } from '../../lib/admin-guards.js';
import { companySettingsService } from '../../services/admin/company-settings.service.js';
import { translationDictionaryService } from '../../services/admin/translation-dictionary.service.js';
export async function osSettingsRoutes(app) {
    const api = '/morbeez-staff/api/v1/os/settings';
    app.get(`${api}/company`, async (request, reply) => {
        await assertModuleAccess(request, 'settings', 'read');
        const company = await companySettingsService.get();
        return reply.send({ ok: true, company });
    });
    app.put(`${api}/company`, async (request, reply) => {
        const actor = await assertModuleAccess(request, 'settings', 'write');
        const body = z
            .object({
            companyName: z.string().max(200).optional(),
            addressLine: z.string().max(500).optional(),
            district: z.string().max(120).optional(),
            state: z.string().max(80).optional(),
            country: z.string().max(80).optional(),
            pincode: z.string().max(12).optional(),
            cin: z.string().max(40).optional(),
            gstin: z.string().max(20).optional(),
            licenceNumber: z.string().max(80).optional(),
            customerCareNumber: z.string().max(20).optional(),
            whatsappNumber: z.string().max(20).optional(),
            termsAndConditions: z.string().max(100_000).optional(),
            quotationLogoUrl: z.string().max(800_000).nullable().optional(),
            bankAccountName: z.string().max(200).optional(),
            bankAccountNumber: z.string().max(40).optional(),
            bankName: z.string().max(120).optional(),
            bankBranch: z.string().max(120).optional(),
            bankIfsc: z.string().max(20).optional(),
        })
            .parse(request.body);
        const company = await companySettingsService.update(body, actor.id);
        await logAdminMutation({
            actorId: actor.id,
            actorEmail: actor.email,
            action: 'update',
            resource: 'company_settings',
            resourceId: 'default',
            details: body,
        });
        return reply.send({ ok: true, company });
    });
    app.get(`${api}/staff`, async (request, reply) => {
        await assertModuleAccess(request, 'settings', 'read');
        const { data, error } = await supabase
            .from('admin_users')
            .select('id, email, full_name, role, active, last_login_at, created_at')
            .order('created_at', { ascending: false });
        throwIfSupabaseError(error, 'Could not load staff');
        return reply.send({
            ok: true,
            staff: (data ?? []).map((u) => ({
                id: u.id,
                email: u.email,
                fullName: u.full_name,
                role: u.role,
                active: u.active,
                lastLoginAt: u.last_login_at,
                createdAt: u.created_at,
            })),
        });
    });
    app.patch(`${api}/staff/:id`, async (request, reply) => {
        const actor = await assertModuleAccess(request, 'settings', 'write');
        const { id } = request.params;
        const body = z
            .object({
            fullName: z.string().min(2).max(120).optional(),
            role: z.enum(CONSOLE_ROLES).optional(),
            active: z.boolean().optional(),
        })
            .parse(request.body);
        if (body.role !== undefined)
            assertCanAssignRole(request, body.role);
        const patch = { updated_at: new Date().toISOString() };
        if (body.fullName !== undefined)
            patch.full_name = body.fullName;
        if (body.role !== undefined)
            patch.role = body.role;
        if (body.active !== undefined)
            patch.active = body.active;
        const { data, error } = await supabase
            .from('admin_users')
            .update(patch)
            .eq('id', id)
            .select('id, email, full_name, role, active, last_login_at, created_at')
            .single();
        throwIfSupabaseError(error, 'Could not update staff');
        await logAdminMutation({
            actorId: actor.id,
            actorEmail: actor.email,
            action: 'update',
            resource: 'admin_users',
            resourceId: id,
            details: body,
        });
        return reply.send({ ok: true, staff: data });
    });
    app.delete(`${api}/staff/:id`, async (request, reply) => {
        const actor = await assertModuleAccess(request, 'settings', 'write');
        const { id } = request.params;
        if (actor.id === id) {
            return reply.code(400).send({ ok: false, message: 'You cannot deactivate your own account' });
        }
        const { data: row, error: rowError } = await supabase
            .from('admin_users')
            .select('role, active')
            .eq('id', id)
            .maybeSingle();
        throwIfSupabaseError(rowError, 'Could not validate staff account');
        if (row?.role === 'super_admin' && row?.active) {
            const { count, error: countError } = await supabase
                .from('admin_users')
                .select('id', { count: 'exact', head: true })
                .eq('role', 'super_admin')
                .eq('active', true);
            throwIfSupabaseError(countError, 'Could not validate super admin guard');
            try {
                assertSuperAdminDeactivationAllowed({
                    role: row.role,
                    active: Boolean(row.active),
                    activeSuperAdminCount: count ?? 0,
                });
            }
            catch (err) {
                const message = err instanceof Error ? err.message : 'Cannot deactivate super admin';
                return reply.code(400).send({ ok: false, message });
            }
        }
        const { error } = await supabase
            .from('admin_users')
            .update({ active: false, updated_at: new Date().toISOString() })
            .eq('id', id);
        throwIfSupabaseError(error, 'Could not deactivate staff');
        await logAdminMutation({
            actorId: actor.id,
            actorEmail: actor.email,
            action: 'archive',
            resource: 'admin_users',
            resourceId: id,
        });
        return reply.send({ ok: true });
    });
    app.get(`${api}/translations`, async (request, reply) => {
        await assertModuleAccess(request, 'settings', 'read');
        const q = request.query;
        const rows = await translationDictionaryService.list({
            category: q.category ?? 'all',
            appScope: q.appScope ?? 'all',
            status: q.status ?? 'all',
            q: q.q,
        });
        return reply.send({ ok: true, rows });
    });
    app.post(`${api}/translations`, async (request, reply) => {
        const actor = await assertModuleAccess(request, 'settings', 'write');
        const body = z
            .object({
            id: z.string().uuid().optional(),
            dictKey: z.string().min(1).max(120),
            category: z
                .enum(['ui_labels', 'advisory_text', 'notification_text', 'error_messages', 'content'])
                .optional(),
            appScope: z.enum(['all', 'farmer', 'agronomist', 'warehouse']).optional(),
            valueEn: z.string().min(1).max(2000),
            valueHi: z.string().max(2000).nullable().optional(),
            valueMl: z.string().max(2000).nullable().optional(),
            valueTa: z.string().max(2000).nullable().optional(),
            valueKn: z.string().max(2000).nullable().optional(),
            translate: z.boolean().optional(),
            status: z.enum(['draft', 'approved', 'archived']).optional(),
            notes: z.string().max(2000).nullable().optional(),
        })
            .parse(request.body ?? {});
        const row = await translationDictionaryService.upsert(body);
        await logAdminMutation({
            actorId: actor.id,
            actorEmail: actor.email,
            action: body.id ? 'update' : 'create',
            resource: 'translation_dictionary',
            resourceId: row.id,
            details: { dictKey: row.dictKey, status: row.status },
        });
        return reply.send({ ok: true, row });
    });
    app.patch(`${api}/translations/:id/status`, async (request, reply) => {
        const actor = await assertModuleAccess(request, 'settings', 'write');
        const { id } = request.params;
        const body = z.object({ status: z.enum(['draft', 'approved', 'archived']) }).parse(request.body ?? {});
        const row = await translationDictionaryService.setStatus(id, body.status);
        await logAdminMutation({
            actorId: actor.id,
            actorEmail: actor.email,
            action: 'update',
            resource: 'translation_dictionary',
            resourceId: id,
            details: { status: body.status },
        });
        return reply.send({ ok: true, row });
    });
    app.delete(`${api}/translations/:id`, async (request, reply) => {
        const actor = await assertModuleAccess(request, 'settings', 'write');
        const { id } = request.params;
        await translationDictionaryService.delete(id);
        await logAdminMutation({
            actorId: actor.id,
            actorEmail: actor.email,
            action: 'delete',
            resource: 'translation_dictionary',
            resourceId: id,
        });
        return reply.send({ ok: true });
    });
    app.post(`${api}/translations/publish`, async (request, reply) => {
        const actor = await assertModuleAccess(request, 'settings', 'write');
        const body = z
            .object({
            locale: z.enum(['en', 'hi', 'ml', 'ta', 'kn']).optional(),
            appScope: z.enum(['all', 'farmer', 'agronomist', 'warehouse']).optional(),
        })
            .parse(request.body ?? {});
        const result = await translationDictionaryService.publishPack(body);
        await logAdminMutation({
            actorId: actor.id,
            actorEmail: actor.email,
            action: 'update',
            resource: 'i18n_pack_meta',
            resourceId: 'bulk',
            details: result,
        });
        return reply.send({ ok: true, ...result });
    });
}
//# sourceMappingURL=os-settings.routes.js.map