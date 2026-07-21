/** Standard soil lab panel — stored in crm_soil_reports.metrics */
export const SOIL_TYPE_OPTIONS = [
    'Sandy',
    'Loamy',
    'Clay',
    'Laterite/Red Soil',
    'Black Soil',
];
export const SOIL_MACRO_FIELDS = [
    { key: 'ph', label: 'pH', unit: '', group: 'macro' },
    { key: 'ec', label: 'EC', unit: 'dS/m', group: 'macro' },
    { key: 'organicCarbon', label: 'Organic Carbon', unit: '%', group: 'macro' },
    { key: 'nitrogen', label: 'Nitrogen (N)', unit: 'kg/ha', group: 'macro' },
    { key: 'phosphorus', label: 'Phosphorus (P)', unit: 'kg/ha', group: 'macro' },
    { key: 'potassium', label: 'Potassium (K)', unit: 'kg/ha', group: 'macro' },
    { key: 'calcium', label: 'Calcium (Ca)', unit: 'ppm', group: 'macro' },
    { key: 'magnesium', label: 'Magnesium (Mg)', unit: 'ppm', group: 'macro' },
    { key: 'sulfur', label: 'Sulfur (S)', unit: 'ppm', group: 'macro' },
    { key: 'sodium', label: 'Sodium (Na)', unit: 'meq/100g', group: 'macro' },
];
export const SOIL_MICRO_FIELDS = [
    { key: 'zinc', label: 'Zinc (Zn)', unit: 'ppm', group: 'micro' },
    { key: 'boron', label: 'Boron (B)', unit: 'ppm', group: 'micro' },
    { key: 'iron', label: 'Iron (Fe)', unit: 'ppm', group: 'micro' },
    { key: 'manganese', label: 'Manganese (Mn)', unit: 'ppm', group: 'micro' },
    { key: 'copper', label: 'Copper (Cu)', unit: 'ppm', group: 'micro' },
    { key: 'molybdenum', label: 'Molybdenum (Mo)', unit: 'ppm', group: 'micro' },
];
export const ALL_SOIL_FIELDS = [...SOIL_MACRO_FIELDS, ...SOIL_MICRO_FIELDS];
export function emptySoilLabMetrics() {
    const macro = {};
    const micro = {};
    for (const f of SOIL_MACRO_FIELDS)
        macro[f.key] = { value: '', unit: f.unit };
    for (const f of SOIL_MICRO_FIELDS)
        micro[f.key] = { value: '', unit: f.unit };
    return { version: 2, macro, micro };
}
export function normalizeSoilMetrics(raw) {
    const base = emptySoilLabMetrics();
    if (!raw || typeof raw !== 'object')
        return base;
    const o = raw;
    if (o.version === 2 && o.macro && o.micro) {
        if (typeof o.soilType === 'string' && o.soilType.trim()) {
            base.soilType = o.soilType.trim();
        }
        if (typeof o.remarks === 'string' && o.remarks.trim()) {
            base.remarks = o.remarks.trim();
        }
        const macro = o.macro;
        const micro = o.micro;
        for (const f of SOIL_MACRO_FIELDS) {
            const v = macro[f.key];
            if (v?.value != null)
                base.macro[f.key] = { value: String(v.value), unit: f.unit };
        }
        for (const f of SOIL_MICRO_FIELDS) {
            const v = micro[f.key];
            if (v?.value != null)
                base.micro[f.key] = { value: String(v.value), unit: f.unit };
        }
        return base;
    }
    const legacyMap = {
        ph: 'ph',
        ec: 'ec',
        organicCarbon: 'organicCarbon',
        nitrogen: 'nitrogen',
        phosphorus: 'phosphorus',
        potassium: 'potassium',
    };
    for (const [legacyKey, targetKey] of Object.entries(legacyMap)) {
        const entry = o[legacyKey];
        if (entry?.value && targetKey in base.macro) {
            base.macro[targetKey].value = String(entry.value).replace(/\s*(dS\/m|%|kg\/ha|ppm).*$/i, '').trim();
        }
    }
    return base;
}
export function buildMetricsFromForm(macro, micro, soilType, remarks) {
    const metrics = emptySoilLabMetrics();
    const st = soilType?.trim();
    if (st)
        metrics.soilType = st;
    const rm = remarks?.trim();
    if (rm)
        metrics.remarks = rm;
    for (const f of SOIL_MACRO_FIELDS) {
        const v = macro[f.key]?.trim();
        if (v)
            metrics.macro[f.key] = { value: v, unit: f.unit };
    }
    for (const f of SOIL_MICRO_FIELDS) {
        const v = micro[f.key]?.trim();
        if (v)
            metrics.micro[f.key] = { value: v, unit: f.unit };
    }
    return metrics;
}
export function metricsToForm(metrics) {
    const macro = {};
    const micro = {};
    for (const f of SOIL_MACRO_FIELDS)
        macro[f.key] = metrics.macro[f.key]?.value ?? '';
    for (const f of SOIL_MICRO_FIELDS)
        micro[f.key] = metrics.micro[f.key]?.value ?? '';
    return { macro, micro, soilType: metrics.soilType ?? '' };
}
/** Parse comma-separated numbers for WhatsApp (macro: 9 values, micro: 5). */
export function parseCommaValues(text, expected) {
    const parts = text
        .split(/[,;\s]+/)
        .map((p) => p.trim())
        .filter(Boolean);
    if (parts.length < expected)
        return null;
    return parts.slice(0, expected);
}
export function applyMacroValues(metrics, values) {
    const next = { ...metrics, macro: { ...metrics.macro } };
    SOIL_MACRO_FIELDS.forEach((f, i) => {
        if (values[i])
            next.macro[f.key] = { value: values[i], unit: f.unit };
    });
    return next;
}
export function applyMicroValues(metrics, values) {
    const next = { ...metrics, micro: { ...metrics.micro } };
    SOIL_MICRO_FIELDS.forEach((f, i) => {
        if (values[i])
            next.micro[f.key] = { value: values[i], unit: f.unit };
    });
    return next;
}
export function formatMetricLine(_f, m) {
    if (!m?.value)
        return '—';
    return m.unit ? `${m.value} ${m.unit}` : m.value;
}
export function formatSoilSummary(metrics, maxLines = 6) {
    const lines = [];
    if (metrics.soilType)
        lines.push(`Soil type: ${metrics.soilType}`);
    for (const field of SOIL_MACRO_FIELDS) {
        const v = metrics.macro[field.key];
        if (v?.value)
            lines.push(`${field.label}: ${formatMetricLine(field, v)}`);
        if (lines.length >= maxLines)
            break;
    }
    return lines.join('\n') || 'Soil test saved';
}
export function macroPrompt(lang) {
    if (lang === 'ml') {
        return ('മാക്രോ ന്യൂട്രിയന്റ്സ് — 9 സംഖ്യകൾ കോമയിൽ അയയ്ക്കുക:\n' +
            'pH, EC (dS/m), Organic Carbon (%), N, P, K (kg/ha), Ca, Mg, S (ppm)\n' +
            'ഉദാ: 6.2, 0.42, 0.54, 245, 18, 180, 1200, 400, 15');
    }
    return ('Macro nutrients — reply with 9 numbers separated by commas:\n' +
        'pH, EC (dS/m), Organic Carbon (%), N, P, K (kg/ha), Ca, Mg, S (ppm)\n' +
        'Example: 6.2, 0.42, 0.54, 245, 18, 180, 1200, 400, 15');
}
export function microPrompt(lang) {
    if (lang === 'ml') {
        return ('മൈക്രോ ന്യൂട്രിയന്റ്സ് — 5 സംഖ്യകൾ കോമയിൽ അയയ്ക്കുക:\n' +
            'Zn, B, Fe, Mn, Cu (ppm)\n' +
            'ഉദാ: 1.2, 0.5, 4.5, 3.1, 0.8');
    }
    return ('Micro nutrients — reply with 5 numbers separated by commas:\n' +
        'Zn, B, Fe, Mn, Cu (ppm)\n' +
        'Example: 1.2, 0.5, 4.5, 3.1, 0.8');
}
export function soilTypePrompt(lang) {
    if (lang === 'ml') {
        return 'മണ്ണിന്റെ തരം — ഒരു നമ്പർ അയയ്ക്കുക:\n1 Sandy\n2 Loamy\n3 Clay\n4 Laterite/Red Soil\n5 Black Soil';
    }
    return ('Soil type — reply with number or name:\n' +
        '1 Sandy\n2 Loamy\n3 Clay\n4 Laterite/Red Soil\n5 Black Soil');
}
export function parseSoilType(text) {
    const t = text.trim().toLowerCase();
    if (!t)
        return null;
    const byNum = {
        '1': 'Sandy',
        '2': 'Loamy',
        '3': 'Clay',
        '4': 'Laterite/Red Soil',
        '5': 'Black Soil',
    };
    if (byNum[t])
        return byNum[t];
    for (const opt of SOIL_TYPE_OPTIONS) {
        if (t === opt.toLowerCase() || opt.toLowerCase().includes(t))
            return opt;
    }
    if (t.includes('sandy'))
        return 'Sandy';
    if (t.includes('loam'))
        return 'Loamy';
    if (t.includes('clay'))
        return 'Clay';
    if (t.includes('laterite') || t.includes('red'))
        return 'Laterite/Red Soil';
    if (t.includes('black'))
        return 'Black Soil';
    return null;
}
export function hasAnyMetricValue(metrics) {
    if (metrics.soilType?.trim())
        return true;
    return [...Object.values(metrics.macro), ...Object.values(metrics.micro)].some((m) => m.value?.trim());
}
/** Flat numeric map for AI rules (N/P/K aliases included). */
export function soilMetricsToFlatRecord(raw) {
    const metrics = normalizeSoilMetrics(raw);
    const out = {};
    for (const field of ALL_SOIL_FIELDS) {
        const group = field.group === 'macro' ? metrics.macro : metrics.micro;
        const rawValue = group[field.key]?.value?.trim();
        if (!rawValue)
            continue;
        const n = parseFloat(rawValue);
        if (!Number.isFinite(n))
            continue;
        out[field.key] = n;
        if (field.key === 'nitrogen')
            out.N = n;
        if (field.key === 'phosphorus')
            out.P = n;
        if (field.key === 'potassium')
            out.K = n;
        if (field.key === 'ph')
            out.pH = n;
    }
    return out;
}
export function soilDeficiencyFlags(raw) {
    const flat = soilMetricsToFlatRecord(raw);
    const flags = [];
    const n = flat.nitrogen ?? flat.N;
    const p = flat.phosphorus ?? flat.P;
    const k = flat.potassium ?? flat.K;
    const ph = flat.ph;
    if (Number.isFinite(n) && n < 200)
        flags.push('low nitrogen');
    if (Number.isFinite(p) && p < 15)
        flags.push('low phosphorus');
    if (Number.isFinite(k) && k < 100)
        flags.push('low potassium');
    if (Number.isFinite(ph) && (ph < 5.5 || ph > 7.5))
        flags.push('suboptimal pH');
    return flags;
}
/** Farmer / AI facing soil summary — supports v2 macro/micro and legacy flat metrics. */
export function formatSoilMetricsForAi(raw, meta) {
    const metrics = normalizeSoilMetrics(raw);
    if (!hasAnyMetricValue(metrics))
        return null;
    const lines = [];
    if (meta?.reportedAt) {
        const date = String(meta.reportedAt).slice(0, 10);
        const lab = meta.labName?.trim();
        lines.push(lab ? `Report date: ${date} (${lab})` : `Report date: ${date}`);
    }
    if (metrics.soilType?.trim())
        lines.push(`Soil type: ${metrics.soilType.trim()}`);
    for (const field of ALL_SOIL_FIELDS) {
        const group = field.group === 'macro' ? metrics.macro : metrics.micro;
        const value = group[field.key];
        if (!value?.value?.trim())
            continue;
        lines.push(`${field.label}: ${formatMetricLine(field, value)}`);
        if (lines.length >= (meta?.maxLines ?? 10))
            break;
    }
    const deficiencies = soilDeficiencyFlags(metrics);
    if (deficiencies.length) {
        lines.push(`Nutrient flags: ${deficiencies.join(', ')}`);
    }
    return lines.join('; ');
}
export function formatSoilMetricsMultiline(raw, meta) {
    const metrics = normalizeSoilMetrics(raw);
    if (!hasAnyMetricValue(metrics))
        return [];
    const lines = [];
    if (meta?.reportedAt) {
        lines.push(`Date: ${String(meta.reportedAt).slice(0, 10)}`);
    }
    for (const field of SOIL_MACRO_FIELDS) {
        const value = metrics.macro[field.key];
        if (!value?.value?.trim())
            continue;
        lines.push(`${field.label}: ${formatMetricLine(field, value)}`);
        if (lines.length >= (meta?.maxLines ?? 8))
            break;
    }
    const deficiencies = soilDeficiencyFlags(metrics);
    if (deficiencies.length) {
        lines.push(`Flags: ${deficiencies.join(', ')}`);
    }
    return lines;
}
//# sourceMappingURL=soil-lab-metrics.js.map