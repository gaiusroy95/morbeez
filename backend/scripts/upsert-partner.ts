/**
 * Create or update a partner for mobile app login testing.
 *
 * Usage (from backend/):
 *   npx tsx scripts/upsert-partner.ts --phone=6282873542 --password='your-password' --name="Partner Name"
 */
import { normalizePhone, isValidIndianPhone } from '../src/lib/phone.js';
import { supabase } from '../src/lib/supabase.js';
import { partnerAuthService } from '../src/services/partner/partner-auth.service.js';
import { partnerService } from '../src/services/partner/partner.service.js';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

async function main() {
  const phoneRaw = arg('phone');
  const password = arg('password');
  const fullName = arg('name') ?? 'Partner User';

  if (!phoneRaw || !password) {
    console.error('Usage: npx tsx scripts/upsert-partner.ts --phone=6282873542 --password=secret --name="Name"');
    process.exit(1);
  }
  if (!isValidIndianPhone(phoneRaw)) {
    console.error('Invalid Indian mobile number');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters');
    process.exit(1);
  }

  const phone = normalizePhone(phoneRaw);
  const existing = await partnerService.getByPhone(phone);

  if (existing) {
    await partnerAuthService.setPassword(existing.id, password);
    const updated = await partnerService.updateStatus(
      existing.id,
      'active',
      'Admin upsert via script',
      'script'
    );
    console.log(
      JSON.stringify(
        {
          action: 'updated',
          id: updated.id,
          partnerCode: updated.partnerCode,
          phone: updated.phone,
          status: updated.status,
        },
        null,
        2
      )
    );
    return;
  }

  const created = await partnerService.createFromApplication({
    fullName,
    phone: phoneRaw,
    district: arg('district') ?? null,
    state: arg('state') ?? null,
    changedBy: 'script',
  });
  await partnerAuthService.setPassword(created.id, password);
  const active = await partnerService.updateStatus(
    created.id,
    'active',
    'Admin seed via script',
    'script'
  );

  console.log(
    JSON.stringify(
      {
        action: 'created',
        id: active.id,
        partnerCode: active.partnerCode,
        phone: active.phone,
        status: active.status,
        passwordHashSet: true,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
