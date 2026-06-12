import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import {
  renderLanguageTemplate,
  type TemplateLanguage,
  type TemplateVariableContext,
} from './language-template-variables.js';

export const languageTemplateResolverService = {
  async getApprovedBody(
    templateKey: string,
    language: string,
    variables?: TemplateVariableContext
  ): Promise<string | null> {
    const lang = (language || 'en').slice(0, 2) as TemplateLanguage;
    const { data: def, error: defErr } = await supabase
      .from('whatsapp_template_definitions')
      .select('status')
      .eq('template_key', templateKey)
      .eq('status', 'approved')
      .maybeSingle();
    if (defErr) throwIfSupabaseError(defErr, 'Could not load template definition');
    if (!def) return null;

    const { data, error } = await supabase
      .from('whatsapp_language_templates')
      .select('body_text, status')
      .eq('template_key', templateKey)
      .eq('language', lang)
      .eq('status', 'approved')
      .eq('active', true)
      .maybeSingle();
    throwIfSupabaseError(error, 'Could not load language template');
    if (!data?.body_text?.trim()) {
      if (lang !== 'en') {
        return this.getApprovedBody(templateKey, 'en', variables);
      }
      return null;
    }
    return renderLanguageTemplate(String(data.body_text), variables);
  },

  async getMetaTemplateName(templateKey: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('whatsapp_template_definitions')
      .select('meta_template_name, channel, status')
      .eq('template_key', templateKey)
      .eq('status', 'approved')
      .maybeSingle();
    throwIfSupabaseError(error, 'Could not load template definition');
    if (!data || data.channel !== 'meta_template') return null;
    return data.meta_template_name ? String(data.meta_template_name) : templateKey;
  },
};
