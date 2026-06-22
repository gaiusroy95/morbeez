import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';

import { textLinesToPdfBuffer } from '../../lib/minimal-pdf.js';

export const visitReportGeneratorService = {
  async generate(findingId: string) {
    const { data, error } = await supabase
      .from('crm_field_findings')
      .select(
        `id, farmer_id, block_id, crop_type, observations, disease_pest, visited_at,
         farmers(name, first_name, last_name, phone, district),
         farm_blocks(name)`
      )
      .eq('id', findingId)
      .single();
    throwIfSupabaseError(error, 'Visit not found');
    if (!data) throw new Error('Visit not found');

    const farmerRaw = data.farmers as unknown;
    const blockRaw = data.farm_blocks as unknown;
    const farmer = (Array.isArray(farmerRaw) ? farmerRaw[0] : farmerRaw) as Record<string, unknown> | null;
    const block = (Array.isArray(blockRaw) ? blockRaw[0] : blockRaw) as Record<string, unknown> | null;
    const farmerName =
      [farmer?.first_name, farmer?.last_name].filter(Boolean).join(' ') ||
      String(farmer?.name ?? 'Farmer');

    const visitDate = String(data.visited_at).slice(0, 10);
    const observation = String(data.observations ?? data.disease_pest ?? '—');

    const farmerText = [
      `Visit report for ${farmerName}`,
      `Plot: ${block?.name ?? '—'} · Crop: ${data.crop_type}`,
      `Visit date: ${visitDate}`,
      `Observation: ${observation}`,
      '— Morbeez field intelligence',
    ].join('\n');

    const agronomistText = [
      `Field finding ${findingId}`,
      `Farmer: ${farmerName} (${farmer?.phone ?? '—'})`,
      `District: ${farmer?.district ?? '—'}`,
      `Block: ${block?.name ?? '—'}`,
      `Crop: ${data.crop_type}`,
      `Disease/pest: ${data.disease_pest ?? '—'}`,
      `Notes: ${data.observations ?? '—'}`,
    ].join('\n');

    const brandHeader = `
      <div style="font-family:system-ui,sans-serif;border-bottom:3px solid #1a7f4b;padding-bottom:12px;margin-bottom:16px">
        <strong style="color:#1a7f4b;font-size:18px">Morbeez</strong>
        <span style="color:#555;margin-left:8px">Field intelligence report</span>
      </div>`;

    const farmerHtml = `${brandHeader}
      <div style="font-family:system-ui,sans-serif;color:#222;line-height:1.5">
        <h2 style="margin:0 0 8px;font-size:16px">Visit report for ${farmerName}</h2>
        <p style="margin:4px 0"><strong>Plot:</strong> ${block?.name ?? '—'} · <strong>Crop:</strong> ${data.crop_type}</p>
        <p style="margin:4px 0"><strong>Visit date:</strong> ${visitDate}</p>
        <p style="margin:8px 0 0"><strong>Observation:</strong> ${observation}</p>
      </div>`;

    const agronomistHtml = `${brandHeader}
      <div style="font-family:system-ui,sans-serif;color:#222;line-height:1.5">
        <h2 style="margin:0 0 8px;font-size:16px">Field finding ${findingId}</h2>
        <p style="margin:4px 0"><strong>Farmer:</strong> ${farmerName} (${farmer?.phone ?? '—'})</p>
        <p style="margin:4px 0"><strong>District:</strong> ${farmer?.district ?? '—'}</p>
        <p style="margin:4px 0"><strong>Block:</strong> ${block?.name ?? '—'} · <strong>Crop:</strong> ${data.crop_type}</p>
        <p style="margin:4px 0"><strong>Disease/pest:</strong> ${data.disease_pest ?? '—'}</p>
        <p style="margin:8px 0 0"><strong>Notes:</strong> ${data.observations ?? '—'}</p>
      </div>`;

    const pdfBuffer = textLinesToPdfBuffer(farmerText.split('\n'));
    const pdfBase64 = pdfBuffer.toString('base64');

    return {
      farmerText,
      agronomistText,
      farmerHtml,
      agronomistHtml,
      format: 'html' as const,
      pdfBase64,
      pdfMimeType: 'application/pdf' as const,
    };
  },
};
