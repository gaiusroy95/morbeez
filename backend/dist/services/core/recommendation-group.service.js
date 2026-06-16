import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
function mapMaterialRow(row) {
    return {
        id: String(row.id),
        groupId: String(row.group_id),
        issueId: row.issue_id ? String(row.issue_id) : null,
        category: String(row.category),
        technicalName: String(row.technical_name),
        dose: row.dose ? String(row.dose) : null,
        method: row.method ? String(row.method) : null,
        relatedIssueId: row.related_issue_id ? String(row.related_issue_id) : null,
        sortOrder: Number(row.sort_order ?? 0),
    };
}
function mapGroupRow(row, materials = []) {
    return {
        id: String(row.id),
        fieldFindingId: String(row.field_finding_id),
        applicationType: String(row.application_type),
        applicationDay: Number(row.application_day ?? 0),
        sortOrder: Number(row.sort_order ?? 0),
        createdAt: String(row.created_at),
        materials,
    };
}
async function loadMaterialsForGroups(groupIds) {
    const map = new Map();
    if (!groupIds.length)
        return map;
    const { data, error } = await supabase
        .from('recommendation_group_materials')
        .select('*')
        .in('group_id', groupIds)
        .order('sort_order', { ascending: true });
    throwIfSupabaseError(error, 'Could not load recommendation group materials');
    for (const row of data ?? []) {
        const groupId = String(row.group_id);
        const list = map.get(groupId) ?? [];
        list.push(mapMaterialRow(row));
        map.set(groupId, list);
    }
    return map;
}
function productsJsonForIssue(groups, visitIssueId) {
    const products = [];
    for (const group of groups) {
        for (const material of group.materials) {
            if (material.issueId && material.issueId !== visitIssueId)
                continue;
            products.push({
                technicalName: material.technicalName,
                dose: material.dose,
                method: material.method,
                category: material.category,
                applicationType: group.applicationType,
                applicationDay: group.applicationDay,
                groupId: group.id,
                relatedIssueId: material.relatedIssueId,
            });
        }
    }
    return products;
}
export const recommendationGroupService = {
    productsJsonForIssue,
    async listByFieldFinding(fieldFindingId) {
        const { data, error } = await supabase
            .from('recommendation_groups')
            .select('*')
            .eq('field_finding_id', fieldFindingId)
            .order('sort_order', { ascending: true });
        throwIfSupabaseError(error, 'Could not load recommendation groups');
        const groupIds = (data ?? []).map((row) => String(row.id));
        const materialsByGroup = await loadMaterialsForGroups(groupIds);
        return (data ?? []).map((row) => mapGroupRow(row, materialsByGroup.get(String(row.id)) ?? []));
    },
    async getById(groupId) {
        const { data, error } = await supabase
            .from('recommendation_groups')
            .select('*')
            .eq('id', groupId)
            .maybeSingle();
        throwIfSupabaseError(error, 'Could not load recommendation group');
        if (!data)
            throw new NotFoundError('Recommendation group not found');
        const materialsByGroup = await loadMaterialsForGroups([groupId]);
        return mapGroupRow(data, materialsByGroup.get(groupId) ?? []);
    },
    async create(fieldFindingId, input) {
        const { data: groupRow, error: groupErr } = await supabase
            .from('recommendation_groups')
            .insert({
            field_finding_id: fieldFindingId,
            application_type: input.applicationType,
            application_day: input.applicationDay ?? 0,
            sort_order: input.sortOrder ?? 0,
        })
            .select('*')
            .single();
        throwIfSupabaseError(groupErr, 'Could not create recommendation group');
        if (!groupRow)
            throw new NotFoundError('Could not create recommendation group');
        const groupId = String(groupRow.id);
        const materials = await this.insertMaterials(groupId, input.materials);
        return mapGroupRow(groupRow, materials);
    },
    async update(groupId, input) {
        await this.getById(groupId);
        const patch = {};
        if (input.applicationType !== undefined)
            patch.application_type = input.applicationType;
        if (input.applicationDay !== undefined)
            patch.application_day = input.applicationDay;
        if (input.sortOrder !== undefined)
            patch.sort_order = input.sortOrder;
        if (Object.keys(patch).length) {
            const { error } = await supabase.from('recommendation_groups').update(patch).eq('id', groupId);
            throwIfSupabaseError(error, 'Could not update recommendation group');
        }
        if (input.materials) {
            const { error: delErr } = await supabase
                .from('recommendation_group_materials')
                .delete()
                .eq('group_id', groupId);
            throwIfSupabaseError(delErr, 'Could not replace recommendation group materials');
            await this.insertMaterials(groupId, input.materials);
        }
        return this.getById(groupId);
    },
    async delete(groupId) {
        const { error } = await supabase.from('recommendation_groups').delete().eq('id', groupId);
        throwIfSupabaseError(error, 'Could not delete recommendation group');
    },
    async replaceForFieldFinding(fieldFindingId, groups) {
        const { error: delErr } = await supabase
            .from('recommendation_groups')
            .delete()
            .eq('field_finding_id', fieldFindingId);
        throwIfSupabaseError(delErr, 'Could not replace recommendation groups');
        const created = [];
        for (let i = 0; i < groups.length; i++) {
            created.push(await this.create(fieldFindingId, {
                ...groups[i],
                sortOrder: groups[i].sortOrder ?? i,
            }));
        }
        return created;
    },
    async insertMaterials(groupId, materials) {
        if (!materials.length)
            return [];
        const rows = materials.map((material, index) => ({
            group_id: groupId,
            issue_id: material.issueId ?? null,
            category: material.category,
            technical_name: material.technicalName,
            dose: material.dose ?? null,
            method: material.method ?? null,
            related_issue_id: material.relatedIssueId ?? null,
            sort_order: material.sortOrder ?? index,
        }));
        const { data, error } = await supabase
            .from('recommendation_group_materials')
            .insert(rows)
            .select('*');
        throwIfSupabaseError(error, 'Could not save recommendation group materials');
        return (data ?? []).map((row) => mapMaterialRow(row));
    },
    primaryApplicationTypeForIssue(groups, visitIssueId) {
        for (const group of groups) {
            const hasIssueMaterial = group.materials.some((material) => !material.issueId || material.issueId === visitIssueId);
            if (hasIssueMaterial)
                return group.applicationType;
        }
        return groups[0]?.applicationType ?? null;
    },
};
//# sourceMappingURL=recommendation-group.service.js.map