/** Map DB record severity → UI review severity */
export function mapRecordSeverityToUi(severity) {
    if (severity === 'low')
        return 'mild';
    if (severity === 'medium')
        return 'moderate';
    if (severity === 'high')
        return 'severe';
    return undefined;
}
/** Map UI review severity → DB record severity */
export function mapUiSeverityToRecord(severity) {
    if (severity === 'mild')
        return 'low';
    if (severity === 'moderate')
        return 'medium';
    if (severity === 'severe')
        return 'high';
    return null;
}
export function isReviewSeverity(value) {
    return value === 'mild' || value === 'moderate' || value === 'severe';
}
export function isRecordSeverity(value) {
    return value === 'low' || value === 'medium' || value === 'high';
}
//# sourceMappingURL=severity.js.map