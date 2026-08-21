import { $ } from '../core.js';
import { renderLeadDetailInto } from './crop-advisor-lead-tabs.js';

export async function renderCropAdvisorLeadDetail(leadId) {
  const el = $('#main-content');
  await renderLeadDetailInto(el, leadId, { inPane: false });
}

export { bindCropAdvisorCrmTopbar, restoreDefaultTopbar, refreshCrmTopbarUser } from './crop-advisor-crm-topbar.js';
