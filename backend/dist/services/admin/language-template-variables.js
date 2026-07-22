export const SUPPORTED_TEMPLATE_LANGUAGES = ['en', 'hi', 'kn', 'ta', 'ml'];
export const STANDARD_TEMPLATE_VARIABLES = [
    { key: 'FarmerName', label: 'Farmer Name', sample: 'Ramesh' },
    { key: 'CropName', label: 'Crop Name', sample: 'Ginger' },
    { key: 'Village', label: 'Village', sample: 'Wayanad' },
    { key: 'DAP', label: 'DAP', sample: '45' },
    { key: 'AdvisorName', label: 'Advisor Name', sample: 'Anil' },
    { key: 'MobileNumber', label: 'Mobile Number', sample: '9876543210' },
];
export const SAMPLE_VARIABLE_CONTEXT = Object.fromEntries(STANDARD_TEMPLATE_VARIABLES.map((v) => [v.key, v.sample]));
const PLACEHOLDER_RE = /\{\{\s*(FarmerName|CropName|Village|DAP|AdvisorName|MobileNumber|name|Crop|crop)\s*\}\}/gi;
export function renderLanguageTemplate(body, ctx = SAMPLE_VARIABLE_CONTEXT) {
    return body.replace(PLACEHOLDER_RE, (_, key) => {
        const k = key.toLowerCase();
        if (k === 'farmername' || k === 'name')
            return ctx.FarmerName ?? ctx.name ?? 'Farmer';
        if (k === 'cropname' || k === 'crop')
            return ctx.CropName ?? ctx.Crop ?? 'crop';
        if (k === 'village')
            return ctx.Village ?? '—';
        if (k === 'dap')
            return ctx.DAP ?? '—';
        if (k === 'advisorname')
            return ctx.AdvisorName ?? 'Advisor';
        if (k === 'mobilenumber')
            return ctx.MobileNumber ?? '';
        return '';
    });
}
export function computeLanguageCompletion(languages) {
    const total = SUPPORTED_TEMPLATE_LANGUAGES.length;
    const perLanguage = {};
    let complete = 0;
    for (const lang of SUPPORTED_TEMPLATE_LANGUAGES) {
        const row = languages[lang];
        const ok = Boolean(row?.bodyText?.trim()) && row?.status !== 'archived';
        perLanguage[lang] = ok;
        if (ok)
            complete++;
    }
    return { complete, total, rate: Math.round((complete / total) * 100), perLanguage };
}
export function displayNameFromKey(key) {
    return key
        .split('_')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}
//# sourceMappingURL=language-template-variables.js.map