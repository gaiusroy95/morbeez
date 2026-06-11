/** Max decoded bytes for base64 image payloads (~8 MB). */
export const MAX_UPLOAD_IMAGE_BYTES = 8 * 1024 * 1024;
export function assertBase64ImageSize(imageData, maxBytes = MAX_UPLOAD_IMAGE_BYTES) {
    const raw = imageData.includes(',') ? imageData.split(',')[1] ?? imageData : imageData;
    const padding = raw.endsWith('==') ? 2 : raw.endsWith('=') ? 1 : 0;
    const approxBytes = Math.floor((raw.length * 3) / 4) - padding;
    if (approxBytes > maxBytes) {
        throw new Error(`Image too large (max ${Math.round(maxBytes / (1024 * 1024))} MB)`);
    }
}
//# sourceMappingURL=upload-limits.js.map