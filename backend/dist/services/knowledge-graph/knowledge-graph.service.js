import { supabase } from '../../lib/supabase.js';
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
    async upsertNode(nodeType, label, metadata) {
        await supabase.from('kg_nodes').upsert({ node_type: nodeType, label, metadata: metadata ?? {} }, { onConflict: 'node_type,label' });
    },
};
//# sourceMappingURL=knowledge-graph.service.js.map