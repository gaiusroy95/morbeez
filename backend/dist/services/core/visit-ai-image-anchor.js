const SYMPTOM_PHOTO_RE = /^(leaf|rhizome|disease|pest|symptom|close|affected|damage|spot|wilt|blight)/i;
export function visitPhotoTypePriority(photoType) {
    if (!photoType?.trim())
        return 1;
    if (SYMPTOM_PHOTO_RE.test(photoType.trim()))
        return 0;
    return 2;
}
export function sortVisitPhotosForDiagnosis(photos) {
    return [...photos].sort((a, b) => visitPhotoTypePriority(a.photoType) - visitPhotoTypePriority(b.photoType));
}
function labelsAlign(a, b) {
    const left = a.trim().toLowerCase();
    const right = b.trim().toLowerCase();
    if (!left || !right)
        return false;
    return left === right || left.includes(right) || right.includes(left);
}
export function anchorPrimaryIssueToImageSignal(issues, imageSignal, minConfidence = 0.5) {
    if (!imageSignal?.label?.trim() || imageSignal.confidence < minConfidence)
        return issues;
    if (!issues.length)
        return issues;
    const imageLabel = imageSignal.label.trim();
    const matchIdx = issues.findIndex((issue) => labelsAlign(issue.issueName, imageLabel));
    if (matchIdx === 0) {
        const primary = issues[0];
        return [
            {
                ...primary,
                confidence: Math.max(primary.confidence, imageSignal.confidence),
                rootCause: {
                    ...primary.rootCause,
                    photoSignals: Array.from(new Set([...(primary.rootCause?.photoSignals ?? []), imageLabel])),
                    conclusion: primary.rootCause?.conclusion || imageLabel,
                },
            },
            ...issues.slice(1),
        ];
    }
    if (matchIdx > 0) {
        const matched = issues[matchIdx];
        const rest = issues.filter((_, idx) => idx !== matchIdx);
        return [
            {
                ...matched,
                confidence: Math.max(matched.confidence, imageSignal.confidence),
                rootCause: {
                    ...matched.rootCause,
                    photoSignals: Array.from(new Set([...(matched.rootCause?.photoSignals ?? []), imageLabel])),
                },
            },
            ...rest,
        ];
    }
    const template = issues[0];
    const anchored = {
        ...template,
        category: template.category,
        issueName: imageLabel,
        confidence: imageSignal.confidence,
        observation: template.observation,
        rootCause: {
            symptoms: template.rootCause?.symptoms ?? [],
            photoSignals: [imageLabel],
            soilSignals: template.rootCause?.soilSignals ?? [],
            weatherSignals: template.rootCause?.weatherSignals ?? [],
            conclusion: imageLabel,
        },
        evidence: template.evidence,
    };
    return [anchored, ...issues];
}
//# sourceMappingURL=visit-ai-image-anchor.js.map