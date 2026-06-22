import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
export const knowledgeGraphService = {
    async queryCandidates(params) {
        const blob = params.symptoms.join(' ').toLowerCase();
        const { data: nodes } = await supabase
            .from('kg_nodes')
            .select('id, label, node_type')
            .in('node_type', ['symptom', 'disease'])
            .limit(50);
        const matches = (nodes ?? []).filter((n) => blob.includes(String(n.label).toLowerCase()));
        if (!matches.length)
            return [];
        const nodeIds = matches.map((n) => n.id);
        const { data: edges } = await supabase
            .from('kg_edges')
            .select('relation, weight, to_node_id')
            .in('from_node_id', nodeIds)
            .limit(params.limit ?? 10);
        const results = [];
        for (const edge of edges ?? []) {
            const { data: target } = await supabase
                .from('kg_nodes')
                .select('label')
                .eq('id', edge.to_node_id)
                .maybeSingle();
            if (target?.label) {
                results.push({
                    label: String(target.label),
                    relation: String(edge.relation),
                    weight: Number(edge.weight ?? 1),
                });
            }
        }
        return results;
    },
    async listNodes(crop, q) {
        const { data, error } = await supabase
            .from('kg_nodes')
            .select('id, node_type, label, crop_type, metadata')
            .order('label')
            .limit(200);
        throwIfSupabaseError(error, 'Could not load KG nodes');
        let nodes = data ?? [];
        if (crop)
            nodes = nodes.filter((n) => String(n.crop_type ?? '').toLowerCase().includes(crop.toLowerCase()));
        if (q)
            nodes = nodes.filter((n) => String(n.label).toLowerCase().includes(q.toLowerCase()));
        return nodes;
    },
    async upsertNode(nodeType, label, metadata) {
        const { data, error } = await supabase
            .from('kg_nodes')
            .upsert({
            node_type: nodeType,
            label,
            crop_type: metadata?.cropType ? String(metadata.cropType) : null,
            metadata: metadata ?? {},
        }, { onConflict: 'node_type,label' })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not upsert KG node');
        return data;
    },
    async updateNode(id, patch) {
        const { data, error } = await supabase
            .from('kg_nodes')
            .update({
            ...(patch.label !== undefined ? { label: patch.label } : {}),
            ...(patch.nodeType !== undefined ? { node_type: patch.nodeType } : {}),
            ...(patch.cropType !== undefined ? { crop_type: patch.cropType } : {}),
            ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
            updated_at: new Date().toISOString(),
        })
            .eq('id', id)
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not update KG node');
        return data;
    },
    async deleteNode(id) {
        await supabase.from('kg_edges').delete().or(`from_node_id.eq.${id},to_node_id.eq.${id}`);
        const { error } = await supabase.from('kg_nodes').delete().eq('id', id);
        throwIfSupabaseError(error, 'Could not delete KG node');
    },
};
//# sourceMappingURL=knowledge-graph.service.js.map