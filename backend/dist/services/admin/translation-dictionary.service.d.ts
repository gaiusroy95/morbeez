export type TranslationCategory = 'ui_labels' | 'advisory_text' | 'notification_text' | 'error_messages' | 'content';
export type TranslationAppScope = 'all' | 'farmer' | 'agronomist' | 'warehouse';
export type TranslationStatus = 'draft' | 'approved' | 'archived';
export type PackLocale = 'en' | 'hi' | 'ml' | 'ta' | 'kn';
export declare const translationDictionaryService: {
    list(params?: {
        category?: TranslationCategory | "all";
        appScope?: TranslationAppScope | "all";
        status?: TranslationStatus | "all";
        q?: string;
        limit?: number;
    }): Promise<{
        id: string;
        dictKey: string;
        category: TranslationCategory;
        appScope: TranslationAppScope;
        valueEn: string;
        valueHi: string | null;
        valueMl: string | null;
        valueTa: string | null;
        valueKn: string | null;
        translate: boolean;
        status: TranslationStatus;
        notes: string | null;
        createdAt: string;
        updatedAt: string;
    }[]>;
    upsert(row: {
        id?: string;
        dictKey: string;
        category?: TranslationCategory;
        appScope?: TranslationAppScope;
        valueEn: string;
        valueHi?: string | null;
        valueMl?: string | null;
        valueTa?: string | null;
        valueKn?: string | null;
        translate?: boolean;
        status?: TranslationStatus;
        notes?: string | null;
    }): Promise<{
        id: string;
        dictKey: string;
        category: TranslationCategory;
        appScope: TranslationAppScope;
        valueEn: string;
        valueHi: string | null;
        valueMl: string | null;
        valueTa: string | null;
        valueKn: string | null;
        translate: boolean;
        status: TranslationStatus;
        notes: string | null;
        createdAt: string;
        updatedAt: string;
    }>;
    setStatus(id: string, status: TranslationStatus): Promise<{
        id: string;
        dictKey: string;
        category: TranslationCategory;
        appScope: TranslationAppScope;
        valueEn: string;
        valueHi: string | null;
        valueMl: string | null;
        valueTa: string | null;
        valueKn: string | null;
        translate: boolean;
        status: TranslationStatus;
        notes: string | null;
        createdAt: string;
        updatedAt: string;
    }>;
    delete(id: string): Promise<void>;
    getPackMeta(locale: PackLocale, appScope: TranslationAppScope): Promise<{
        locale: PackLocale;
        appScope: TranslationAppScope;
        version: number;
        publishedAt: string;
    }>;
    publishPack(params: {
        locale?: PackLocale;
        appScope?: TranslationAppScope;
    }): Promise<{
        version: number;
        locales: PackLocale[];
        scopes: TranslationAppScope[];
    }>;
    buildLanguagePack(params: {
        locale: PackLocale;
        appScope: TranslationAppScope;
        category?: TranslationCategory | "all";
    }): Promise<{
        locale: PackLocale;
        appScope: TranslationAppScope;
        version: number;
        publishedAt: string;
        strings: Record<string, string>;
        keepEnglish: string[];
    }>;
};
//# sourceMappingURL=translation-dictionary.service.d.ts.map