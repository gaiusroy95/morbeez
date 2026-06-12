import { api } from './api';

export const OPERATIONS_API = '/morbeez-staff/api/v1/os/operations';

export const TEMPLATE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'kn', label: 'Kannada' },
  { code: 'ta', label: 'Tamil' },
  { code: 'ml', label: 'Malayalam' },
] as const;

export type TemplateLanguage = (typeof TEMPLATE_LANGUAGES)[number]['code'];

export const TEMPLATE_VARIABLES = [
  { key: 'FarmerName', label: 'Farmer Name' },
  { key: 'CropName', label: 'Crop Name' },
  { key: 'Village', label: 'Village' },
  { key: 'DAP', label: 'DAP' },
  { key: 'AdvisorName', label: 'Advisor Name' },
  { key: 'MobileNumber', label: 'Mobile Number' },
] as const;

export const TEMPLATE_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'advisory', label: 'Advisory' },
  { value: 'orders', label: 'Orders' },
  { value: 'broadcast', label: 'Broadcast' },
  { value: 'notification', label: 'Notification' },
] as const;

export type GroupedLanguageTemplate = {
  templateKey: string;
  displayName: string;
  category: string;
  channel: string;
  metaTemplateName: string | null;
  status: string;
  completionRate: number;
  languageComplete: Record<string, boolean>;
  masterLanguage: string;
  languages: Record<
    string,
    {
      id?: string;
      bodyText: string;
      headerText: string | null;
      footerText: string | null;
      status: string;
    }
  >;
  workflowJson: Record<string, string>;
  variableSchema: string[];
  updatedAt: string;
};

export async function fetchGroupedTemplates(params?: {
  status?: string;
  category?: string;
  search?: string;
}) {
  const q = new URLSearchParams();
  if (params?.status && params.status !== 'all') q.set('status', params.status);
  if (params?.category && params.category !== 'all') q.set('category', params.category);
  if (params?.search) q.set('search', params.search);
  const suffix = q.toString() ? `?${q}` : '';
  return api<{ ok: boolean; templates: GroupedLanguageTemplate[] }>(
    `${OPERATIONS_API}/language-templates${suffix}`
  );
}

export async function fetchTemplateDetail(templateKey: string) {
  return api<{ ok: boolean; template: GroupedLanguageTemplate }>(
    `${OPERATIONS_API}/language-templates/${encodeURIComponent(templateKey)}`
  );
}

export async function createTemplateDefinition(input: {
  templateKey: string;
  displayName?: string;
  category?: string;
}) {
  return api<{ ok: boolean; template: GroupedLanguageTemplate }>(
    `${OPERATIONS_API}/language-templates`,
    { method: 'POST', body: JSON.stringify(input) }
  );
}

export async function saveTemplateBundle(
  templateKey: string,
  body: Record<string, unknown>
) {
  return api<{ ok: boolean; template: GroupedLanguageTemplate }>(
    `${OPERATIONS_API}/language-templates/${encodeURIComponent(templateKey)}`,
    { method: 'PUT', body: JSON.stringify(body) }
  );
}

export async function duplicateTemplate(templateKey: string, newKey: string) {
  return api<{ ok: boolean; template: GroupedLanguageTemplate }>(
    `${OPERATIONS_API}/language-templates/${encodeURIComponent(templateKey)}/duplicate`,
    { method: 'POST', body: JSON.stringify({ newKey }) }
  );
}

export async function previewTemplate(
  templateKey: string,
  language: TemplateLanguage,
  bodyText?: string
) {
  return api<{ ok: boolean; preview: { rendered: string; raw: string } }>(
    `${OPERATIONS_API}/language-templates/${encodeURIComponent(templateKey)}/preview`,
    {
      method: 'POST',
      body: JSON.stringify({
        language,
        variables: Object.fromEntries(
          TEMPLATE_VARIABLES.map((v) => [
            v.key,
            v.key === 'FarmerName' ? 'Ramesh' : v.key === 'CropName' ? 'Ginger' : '—',
          ])
        ),
      }),
    }
  );
}

export async function translateTemplate(templateKey: string, targetLanguages: TemplateLanguage[]) {
  return api<{ ok: boolean; template: GroupedLanguageTemplate }>(
    `${OPERATIONS_API}/language-templates/${encodeURIComponent(templateKey)}/translate`,
    { method: 'POST', body: JSON.stringify({ targetLanguages }) }
  );
}

export async function copyTemplateToAll(templateKey: string) {
  return api<{ ok: boolean; template: GroupedLanguageTemplate }>(
    `${OPERATIONS_API}/language-templates/${encodeURIComponent(templateKey)}/copy-to-all`,
    { method: 'POST', body: JSON.stringify({}) }
  );
}

export const SAMPLE_PREVIEW_VARS: Record<string, string> = {
  FarmerName: 'Ramesh',
  CropName: 'Ginger',
  Village: 'Wayanad',
  DAP: '45',
  AdvisorName: 'Anil',
  MobileNumber: '9876543210',
};

export function renderPreview(body: string): string {
  return body.replace(
    /\{\{\s*(FarmerName|CropName|Village|DAP|AdvisorName|MobileNumber|name|Crop|crop)\s*\}\}/gi,
    (_, key: string) => {
      const k = key.toLowerCase();
      if (k === 'farmername' || k === 'name') return SAMPLE_PREVIEW_VARS.FarmerName;
      if (k === 'cropname' || k === 'crop') return SAMPLE_PREVIEW_VARS.CropName;
      if (k === 'village') return SAMPLE_PREVIEW_VARS.Village;
      if (k === 'dap') return SAMPLE_PREVIEW_VARS.DAP;
      if (k === 'advisorname') return SAMPLE_PREVIEW_VARS.AdvisorName;
      if (k === 'mobilenumber') return SAMPLE_PREVIEW_VARS.MobileNumber;
      return '';
    }
  );
}
