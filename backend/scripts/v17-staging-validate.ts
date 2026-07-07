#!/usr/bin/env node
/**
 * MORBEEZ v17 staging pre-flight validator.
 * Run before enabling MAIOS_REASONING_SHADOW=false on staging.
 *
 * Usage: cd backend && node --import tsx scripts/v17-staging-validate.ts
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../src/config/env.js';

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED_ENV = [
  'ENABLE_MAIOS_REASONING',
  'ENABLE_STRUCTURED_VISION',
  'MAIOS_REASONING_SHADOW',
] as const;

const GOLD_TEST_FILES = [
  'tests/diagnosis-gold-cases.test.ts',
  'tests/maios-reasoning.test.ts',
  'tests/plant-id-vision-features.test.ts',
];

function printHeader(title: string) {
  console.log(`\n=== ${title} ===`);
}

function checkEnv(): boolean {
  printHeader('Environment flags');
  let ok = true;
  for (const key of REQUIRED_ENV) {
    const value = env[key];
    const display = value === undefined ? '(unset — uses default)' : String(value);
    console.log(`  ${key}=${display}`);
    if (key === 'MAIOS_REASONING_SHADOW' && value !== false) {
      console.log('  ⚠ Staging pilot expects MAIOS_REASONING_SHADOW=false for Bayesian-owned diagnosis');
      ok = false;
    }
    if (key === 'ENABLE_MAIOS_REASONING' && value === false) {
      console.log('  ✗ ENABLE_MAIOS_REASONING must not be false on staging');
      ok = false;
    }
    if (key === 'ENABLE_STRUCTURED_VISION' && value === false) {
      console.log('  ✗ ENABLE_STRUCTURED_VISION must not be false on staging');
      ok = false;
    }
  }
  if (ok) console.log('  ✓ Env flags OK for staging pilot');
  return ok;
}

function runGoldTests(): boolean {
  printHeader('Gold-case regression gate');
  const args = ['--import', 'tsx', '--test', ...GOLD_TEST_FILES];
  const result = spawnSync(process.execPath, args, {
    cwd: backendRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  const pass = result.status === 0;
  console.log(pass ? '  ✓ All gold-case tests passed' : '  ✗ Gold-case tests failed — do not enable shadow=false');
  return pass;
}

function printManualChecklist() {
  printHeader('Manual staging checklist (see docs/v17-staging-activation.md)');
  const items = [
    'Visit wizard: reasoning.finalReport on analyze; top hypothesis from posterior when shadow off',
    'Visit close: log "MAIOS v17 agronomist-verified visit outcome recorded"',
    'WhatsApp: maiosCase.reasoning present; probableIssue matches posterior when shadow off',
    'EVSI: first follow-up question from knowledge pack (not generic LLM filler)',
    'Escalation review: learningFacadeRecorded: true on submitReview',
    'v17 API: POST /api/v1/diagnosis/start returns finalReport + nextEvidence',
    'Rollback drill: set MAIOS_REASONING_SHADOW=true and confirm LLM ranking restored',
    'Field pilot: 10 real cases — agronomist agrees with Bayesian top ≥8/10',
  ];
  for (const item of items) {
    console.log(`  [ ] ${item}`);
  }
}

function main() {
  console.log('MORBEEZ v17 Staging Pre-Flight Validator');
  const envOk = checkEnv();
  const testsOk = runGoldTests();
  printManualChecklist();

  printHeader('Result');
  if (envOk && testsOk) {
    console.log('READY for staging pilot (complete manual checklist before production).');
    process.exit(0);
  }
  console.log('NOT READY — fix env and/or tests before staging activation.');
  process.exit(1);
}

main();
