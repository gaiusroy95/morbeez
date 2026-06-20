import { supabase } from '../../lib/supabase.js';
export const cultivationContextService = {
    async loadForBlock(params) {
        const crop = params.cropType.toLowerCase().trim();
        const dap = params.dap ?? null;
        let q = supabase
            .from('cultivation_task_master')
            .select('task_key, title_en, target_dap_min, target_dap_max, priority')
            .eq('crop_type', crop)
            .eq('active', true)
            .order('priority', { ascending: false })
            .limit(20);
        const { data: tasks } = await q;
        const overdue = [];
        const upcoming = [];
        for (const t of tasks ?? []) {
            const row = {
                taskKey: String(t.task_key),
                title: String(t.title_en),
                priority: Number(t.priority ?? 50),
            };
            const min = t.target_dap_min != null ? Number(t.target_dap_min) : null;
            const max = t.target_dap_max != null ? Number(t.target_dap_max) : null;
            if (dap != null && max != null && dap > max) {
                overdue.push(row);
            }
            else if (dap != null && min != null && dap >= min - 7 && dap <= (max ?? min + 14)) {
                upcoming.push(row);
            }
            else if (dap == null) {
                upcoming.push(row);
            }
        }
        return {
            overdueTasks: overdue.slice(0, 5),
            upcomingTasks: upcoming.slice(0, 5),
            hasOverdue: overdue.length > 0,
        };
    },
};
//# sourceMappingURL=cultivation-context.service.js.map