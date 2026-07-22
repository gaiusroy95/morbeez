/**
 * True when the AI/MAIOS case should open the field site-visit wizard
 * (not the desk-only AI case review form).
 */
export function caseNeedsSiteVisit(input) {
    const route = String(input.maiosRoute ?? '')
        .trim()
        .toLowerCase();
    if (route === 'field_visit' || route === 'emergency_callback')
        return true;
    const reason = String(input.reason ?? '')
        .trim()
        .toLowerCase();
    if (!reason)
        return false;
    return (reason.includes('field_visit') ||
        reason.includes('emergency_callback') ||
        reason.includes('site visit') ||
        reason.includes('field visit') ||
        /maios.*route:\s*field_visit/.test(reason) ||
        /maios.*route:\s*emergency_callback/.test(reason));
}
//# sourceMappingURL=case-needs-site-visit.js.map