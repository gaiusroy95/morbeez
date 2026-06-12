import { type TemplateLanguage, type TemplateVariableContext } from './language-template-variables.js';
export type QuickReplyCategory = 'general' | 'telecaller' | 'advisory' | 'orders' | 'broadcast';
export declare const operationsMessagingService: {
    listQuickReplies(category?: string): Promise<any[]>;
    upsertQuickReply(row: {
        id?: string;
        shortcutKey: string;
        category?: QuickReplyCategory;
        labelEn: string;
        bodyEn: string;
        bodyMl?: string;
        bodyTa?: string;
        bodyKn?: string;
        bodyHi?: string;
        active?: boolean;
        sortOrder?: number;
    }): Promise<any>;
    deleteQuickReply(id: string): Promise<void>;
    /** Resolve body for a language (falls back to English). */
    resolveQuickReplyBody(row: {
        body_en: string;
        body_ml?: string | null;
        body_ta?: string | null;
        body_kn?: string | null;
        body_hi?: string | null;
    }, language: string): string;
    listLanguageTemplates(params?: {
        templateKey?: string;
        language?: string;
        status?: string;
        category?: string;
        search?: string;
    }): Promise<{
        templateKey: string;
        displayName: string;
        category: string;
        channel: string;
        metaTemplateName: string | null;
        status: string;
        variableSchema: string[];
        workflowJson: Record<string, unknown>;
        masterLanguage: string;
        languages: Record<string, {
            id?: string;
            bodyText: string;
            headerText: string | null;
            footerText: string | null;
            status: string;
            channel: string;
            metaTemplateName: string | null;
        }>;
        completionRate: number;
        languageComplete: Record<string, boolean>;
        createdAt: string;
        updatedAt: string;
    }[]>;
    getLanguageTemplate(templateKey: string): Promise<{
        templateKey: string;
        displayName: string;
        category: string;
        channel: string;
        metaTemplateName: string | null;
        status: string;
        variableSchema: string[];
        workflowJson: Record<string, unknown>;
        masterLanguage: string;
        languages: Record<string, {
            id?: string;
            bodyText: string;
            headerText: string | null;
            footerText: string | null;
            status: string;
            channel: string;
            metaTemplateName: string | null;
        }>;
        completionRate: number;
        languageComplete: Record<string, boolean>;
        createdAt: string;
        updatedAt: string;
    }>;
    createLanguageTemplateDefinition(input: {
        templateKey: string;
        displayName?: string;
        category?: string;
        channel?: "session" | "meta_template";
        metaTemplateName?: string;
        masterLanguage?: TemplateLanguage;
        initialBody?: string;
    }): Promise<{
        templateKey: string;
        displayName: string;
        category: string;
        channel: string;
        metaTemplateName: string | null;
        status: string;
        variableSchema: string[];
        workflowJson: Record<string, unknown>;
        masterLanguage: string;
        languages: Record<string, {
            id?: string;
            bodyText: string;
            headerText: string | null;
            footerText: string | null;
            status: string;
            channel: string;
            metaTemplateName: string | null;
        }>;
        completionRate: number;
        languageComplete: Record<string, boolean>;
        createdAt: string;
        updatedAt: string;
    }>;
    saveLanguageTemplateBundle(templateKey: string, input: {
        displayName?: string;
        category?: string;
        channel?: "session" | "meta_template";
        metaTemplateName?: string | null;
        status?: string;
        masterLanguage?: TemplateLanguage;
        languages?: Partial<Record<TemplateLanguage, {
            bodyText?: string;
            headerText?: string;
            footerText?: string;
            status?: string;
        }>>;
    }): Promise<{
        templateKey: string;
        displayName: string;
        category: string;
        channel: string;
        metaTemplateName: string | null;
        status: string;
        variableSchema: string[];
        workflowJson: Record<string, unknown>;
        masterLanguage: string;
        languages: Record<string, {
            id?: string;
            bodyText: string;
            headerText: string | null;
            footerText: string | null;
            status: string;
            channel: string;
            metaTemplateName: string | null;
        }>;
        completionRate: number;
        languageComplete: Record<string, boolean>;
        createdAt: string;
        updatedAt: string;
    }>;
    duplicateLanguageTemplate(templateKey: string, newKey: string): Promise<{
        templateKey: string;
        displayName: string;
        category: string;
        channel: string;
        metaTemplateName: string | null;
        status: string;
        variableSchema: string[];
        workflowJson: Record<string, unknown>;
        masterLanguage: string;
        languages: Record<string, {
            id?: string;
            bodyText: string;
            headerText: string | null;
            footerText: string | null;
            status: string;
            channel: string;
            metaTemplateName: string | null;
        }>;
        completionRate: number;
        languageComplete: Record<string, boolean>;
        createdAt: string;
        updatedAt: string;
    }>;
    previewLanguageTemplate(templateKey: string, language: TemplateLanguage, variables?: TemplateVariableContext): Promise<{
        language: "en" | "ml" | "ta" | "kn" | "hi";
        rendered: string;
        raw: string;
    }>;
    copyLanguageTemplateToAll(templateKey: string): Promise<{
        templateKey: string;
        displayName: string;
        category: string;
        channel: string;
        metaTemplateName: string | null;
        status: string;
        variableSchema: string[];
        workflowJson: Record<string, unknown>;
        masterLanguage: string;
        languages: Record<string, {
            id?: string;
            bodyText: string;
            headerText: string | null;
            footerText: string | null;
            status: string;
            channel: string;
            metaTemplateName: string | null;
        }>;
        completionRate: number;
        languageComplete: Record<string, boolean>;
        createdAt: string;
        updatedAt: string;
    }>;
    translateLanguageTemplate(templateKey: string, targetLanguages: TemplateLanguage[]): Promise<{
        templateKey: string;
        displayName: string;
        category: string;
        channel: string;
        metaTemplateName: string | null;
        status: string;
        variableSchema: string[];
        workflowJson: Record<string, unknown>;
        masterLanguage: string;
        languages: Record<string, {
            id?: string;
            bodyText: string;
            headerText: string | null;
            footerText: string | null;
            status: string;
            channel: string;
            metaTemplateName: string | null;
        }>;
        completionRate: number;
        languageComplete: Record<string, boolean>;
        createdAt: string;
        updatedAt: string;
    }>;
    upsertLanguageTemplate(row: {
        id?: string;
        templateKey: string;
        language: string;
        channel?: "session" | "meta_template";
        bodyText: string;
        headerText?: string;
        footerText?: string;
        metaTemplateName?: string;
        variableHints?: unknown[];
        status?: string;
        active?: boolean;
        notes?: string;
    }): Promise<any>;
    deleteLanguageTemplate(id: string): Promise<void>;
    listAutomationJobs(params: {
        status?: string;
        jobType?: string;
        limit?: number;
        page?: number;
    }): Promise<{
        jobs: any[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    }>;
    getAutomationStats(): Promise<{
        dueNow: number;
    }>;
    cancelAutomationJob(id: string): Promise<any>;
    retryAutomationJob(id: string): Promise<any>;
};
//# sourceMappingURL=operations-messaging.service.d.ts.map