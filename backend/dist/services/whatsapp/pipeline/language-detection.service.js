const ALLOWED = ['en', 'ml', 'ta', 'kn', 'hi'];
/** Normalize stored / session language code. */
export function normalizeLanguage(_detected, stored) {
    if (stored && ALLOWED.includes(stored))
        return stored;
    return 'en';
}
//# sourceMappingURL=language-detection.service.js.map