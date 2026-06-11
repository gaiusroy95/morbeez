import { z } from 'zod';
import { translationDictionaryService, } from '../../services/admin/translation-dictionary.service.js';
const localeSchema = z.enum(['en', 'hi', 'ml', 'ta', 'kn']);
const appScopeSchema = z.enum(['all', 'farmer', 'agronomist', 'warehouse']);
const categorySchema = z.enum([
    'ui_labels',
    'advisory_text',
    'notification_text',
    'error_messages',
    'content',
]);
/** Public/mobile language pack download — no auth required. */
export async function i18nRoutes(app) {
    const api = '/api/v1/i18n';
    app.get(`${api}/packs/:locale`, async (request, reply) => {
        const { locale } = request.params;
        const parsedLocale = localeSchema.parse(locale);
        const q = request.query;
        const appScope = (q.app ? appScopeSchema.parse(q.app) : 'all');
        const category = (q.category ? categorySchema.parse(q.category) : 'all');
        const clientVersion = q.version ? Number(q.version) : 0;
        const pack = await translationDictionaryService.buildLanguagePack({
            locale: parsedLocale,
            appScope,
            category,
        });
        if (clientVersion > 0 && clientVersion >= pack.version) {
            return reply.send({
                ok: true,
                unchanged: true,
                version: pack.version,
                locale: pack.locale,
                appScope: pack.appScope,
            });
        }
        return reply.send({
            ok: true,
            unchanged: false,
            version: pack.version,
            locale: pack.locale,
            appScope: pack.appScope,
            publishedAt: pack.publishedAt,
            strings: pack.strings,
            keepEnglish: pack.keepEnglish,
        });
    });
    app.get(`${api}/manifest`, async (request, reply) => {
        const q = request.query;
        const appScope = (q.app ? appScopeSchema.parse(q.app) : 'all');
        const locales = ['en', 'hi', 'ml', 'ta', 'kn'];
        const packs = await Promise.all(locales.map(async (locale) => {
            const meta = await translationDictionaryService.getPackMeta(locale, appScope);
            return { locale, version: meta.version, publishedAt: meta.publishedAt };
        }));
        return reply.send({ ok: true, appScope, packs });
    });
}
//# sourceMappingURL=i18n.routes.js.map