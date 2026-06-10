#!/usr/bin/env node
/**
 * Staging smoke script — farmer login → portal summary → store catalog page 1.
 * Usage: API_BASE_URL=https://staging-api.example.com FARMER_EMAIL=... FARMER_PASSWORD=... node scripts/farmer-smoke.mjs
 */
const base = (process.env.API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
const email = process.env.FARMER_EMAIL;
const password = process.env.FARMER_PASSWORD;

if (!base || !email || !password) {
  console.error('Set API_BASE_URL, FARMER_EMAIL, FARMER_PASSWORD');
  process.exit(1);
}

async function json(path, init = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} ${res.status}: ${body.message || res.statusText}`);
  return body;
}

async function main() {
  console.log('Health…');
  const health = await json('/health');
  console.log('  features:', health.features);

  console.log('Login…');
  const login = await json('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  const token = login.token;
  const auth = { Authorization: `Bearer ${token}` };

  console.log('Portal summary…');
  await json('/api/v1/farmer/portal/summary', { headers: auth });

  console.log('Store catalog…');
  await json('/api/v1/store/products?limit=5');

  console.log('Blocks…');
  await json('/api/v1/farmer/portal/blocks', { headers: auth });

  console.log('Smoke OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
