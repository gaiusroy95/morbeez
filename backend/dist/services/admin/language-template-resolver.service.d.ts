import { type TemplateVariableContext } from './language-template-variables.js';
export declare const languageTemplateResolverService: {
    getApprovedBody(templateKey: string, language: string, variables?: TemplateVariableContext): Promise<string | null>;
    getMetaTemplateName(templateKey: string): Promise<string | null>;
};
//# sourceMappingURL=language-template-resolver.service.d.ts.map