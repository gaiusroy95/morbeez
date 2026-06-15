#!/usr/bin/env node
/**
 * Visit AI API smoke checklist (requires STAFF_TOKEN + farmer/block UUIDs).
 *
 * Usage:
 *   STAFF_TOKEN=... FARMER_ID=... BLOCK_ID=... node backend/scripts/visit-ai-smoke.mjs
 */
const base = process.env.API_BASE ?? 'http://localhost:3000/morbeez-staff/api/v1/os/field';
const token = process.env.STAFF_TOKEN;
const farmerId = process.env.FARMER_ID;
const blockId = process.env.BLOCK_ID;

if (!token || !farmerId || !blockId) {
  console.error('Set STAFF_TOKEN, FARMER_ID, and BLOCK_ID');
  process.exit(1);
}

async function api(path, init = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

async function main() {
  console.log('1. context');
  await api('/visits/context', {
    method: 'POST',
    body: JSON.stringify({ farmerId, blockId }),
  });

  console.log('2. analyze');
  const analyzed = await api('/visits/analyze', {
    method: 'POST',
    body: JSON.stringify({
      farmerId,
      blockId,
      issueCategory: 'disease',
      issueName: 'Smoke test issue',
      observation: 'Automated smoke visit',
    }),
  });
  const aiCaseId = analyzed.aiCaseId;
  if (!aiCaseId) throw new Error('analyze missing aiCaseId');

  console.log('3. questions');
  await api(`/visits/ai-case/${aiCaseId}/questions`);

  console.log('4. answers + reanalyze');
  const { questions } = await api(`/visits/ai-case/${aiCaseId}/questions`);
  if (questions?.[0]?.id) {
    await api(`/visits/ai-case/${aiCaseId}/questions`, {
      method: 'POST',
      body: JSON.stringify({ answers: [{ questionId: questions[0].id, answer: 'yes' }] }),
    });
    await api(`/visits/ai-case/${aiCaseId}/reanalyze`, { method: 'POST' });
  } else {
    console.log('   (no questions — trying skip-qa)');
    await api(`/visits/ai-case/${aiCaseId}/skip-qa`, { method: 'POST' });
  }

  console.log('5. recommend');
  await api(`/visits/ai-case/${aiCaseId}/recommend`, {
    method: 'POST',
    body: JSON.stringify({ finalDiagnosis: analyzed.hypotheses?.[0]?.label ?? 'Smoke test issue' }),
  });

  console.log('6. case detail');
  await api(`/visits/ai-case/${aiCaseId}`);

  console.log('7. case library');
  await api('/visits/case-library?limit=5');

  console.log('Visit AI smoke OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
