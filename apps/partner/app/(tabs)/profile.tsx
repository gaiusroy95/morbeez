import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { partnerClient, tokens, type PartnerEarningsSummary } from '@morbeez/shared';
import { AlertBox, Btn, KeyValueRow, Loading, Panel } from '@morbeez/ui-native';
import { EarningsRangeFilter } from '@/components/EarningsRangeFilter';
import { usePartnerAuth } from '@/context/PartnerAuth';
import {
  defaultEarningsRange,
  formatRangeLabel,
  type EarningsDateRange,
} from '@/lib/earnings-date-range';

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function ProfileScreen() {
  const { partner, logout } = usePartnerAuth();
  const router = useRouter();
  const [range, setRange] = useState<EarningsDateRange>(defaultEarningsRange);
  const [earnings, setEarnings] = useState<PartnerEarningsSummary | null>(null);
  const [loadingEarnings, setLoadingEarnings] = useState(true);
  const [error, setError] = useState('');

  const loadEarnings = useCallback(async (nextRange: EarningsDateRange) => {
    setLoadingEarnings(true);
    setError('');
    try {
      const summary = await partnerClient.getEarningsSummary({
        from: nextRange.from,
        to: nextRange.to,
      });
      setEarnings({
        month: summary.month != null ? String(summary.month) : null,
        fromDate: summary.fromDate != null ? String(summary.fromDate) : nextRange.from,
        toDate: summary.toDate != null ? String(summary.toDate) : nextRange.to,
        serviceRevenue: Number(summary.serviceRevenue ?? 0),
        productCommission: Number(summary.productCommission ?? 0),
        leadBonus: Number(summary.leadBonus ?? 0),
        successBonus: Number(summary.successBonus ?? 0),
        pendingPayout: Number(summary.pendingPayout ?? 0),
        approvedPayout: Number(summary.approvedPayout ?? 0),
        paidPayout: Number(summary.paidPayout ?? 0),
        reliabilityHoldPct: Number(summary.reliabilityHoldPct ?? 0),
        farmersIntroduced: Number(summary.farmersIntroduced ?? 0),
        farmersVerified: Number(summary.farmersVerified ?? 0),
        eligibleIntroductions: Number(summary.eligibleIntroductions ?? 0),
        cashRewardEarned: Number(summary.cashRewardEarned ?? summary.cashRewards ?? 0),
        cashRewards: Number(summary.cashRewards ?? 0),
        productRewardAvailable: Number(summary.productRewardAvailable ?? 0),
        productRewardUsed: Number(summary.productRewardUsed ?? 0),
        productRewardBalance: Number(summary.productRewardBalance ?? 0),
        heldPayout: Number(summary.heldPayout ?? 0),
        duePayout: Number(summary.duePayout ?? 0),
        months: Array.isArray(summary.months)
          ? (summary.months as Array<Record<string, unknown>>).map((m) => ({
              month: String(m.month),
              earned: Number(m.earned ?? 0),
              held: Number(m.held ?? 0),
              due: Number(m.due ?? 0),
              paid: Number(m.paid ?? 0),
            }))
          : [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load earnings');
    } finally {
      setLoadingEarnings(false);
    }
  }, []);

  useEffect(() => {
    void loadEarnings(range);
  }, [loadEarnings, range]);

  function onRangeChange(next: EarningsDateRange) {
    setRange(next);
  }

  const periodLabel =
    earnings?.fromDate && earnings?.toDate
      ? formatRangeLabel(String(earnings.fromDate), String(earnings.toDate))
      : earnings?.month ?? formatRangeLabel(range.from, range.to);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Panel title="Partner profile">
        <KeyValueRow label="Name" value={partner?.fullName ?? '—'} />
        <KeyValueRow label="Code" value={partner?.partnerCode ?? '—'} />
        <KeyValueRow label="Tier" value={partner?.tier ?? '—'} />
        <KeyValueRow label="Status" value={partner?.status ?? '—'} />
        <KeyValueRow label="Active farmers" value={String(partner?.currentActiveFarmers ?? 0)} />
      </Panel>

      <View style={styles.panel}>
        <EarningsRangeFilter title="Earnings summary" range={range} onChange={onRangeChange} />
        {loadingEarnings ? (
          <Loading label="Loading earnings…" />
        ) : earnings ? (
          <>
            <KeyValueRow label="Period" value={periodLabel} />
            <KeyValueRow label="Service revenue" value={formatInr(earnings.serviceRevenue)} />
            <KeyValueRow label="Product commission" value={formatInr(earnings.productCommission)} />
            <KeyValueRow label="Lead bonus" value={formatInr(earnings.leadBonus)} />
            <KeyValueRow label="Success bonus" value={formatInr(earnings.successBonus)} />
            <KeyValueRow
              label="₹100 intro cash"
              value={formatInr(Number(earnings.cashRewardEarned ?? earnings.cashRewards ?? 0))}
            />
            <KeyValueRow
              label="₹400 product used"
              value={formatInr(Number(earnings.productRewardUsed ?? 0))}
            />
            <KeyValueRow
              label="₹400 product balance"
              value={formatInr(Number(earnings.productRewardBalance ?? 0))}
            />
            <KeyValueRow
              label="Eligible introductions"
              value={String(earnings.eligibleIntroductions ?? 0)}
            />
            <KeyValueRow label="Pending payout" value={formatInr(earnings.pendingPayout)} />
            <KeyValueRow label="Due now" value={formatInr(Number(earnings.duePayout ?? 0))} />
            <KeyValueRow label="Held (fraud)" value={formatInr(Number(earnings.heldPayout ?? 0))} />
            <KeyValueRow label="Approved payout" value={formatInr(earnings.approvedPayout)} />
            <KeyValueRow label="Paid payout" value={formatInr(earnings.paidPayout)} />
            {(earnings.months ?? []).length ? (
              <>
                <Text style={styles.hint}>Last 3 months</Text>
                {earnings.months?.map((m) => (
                  <KeyValueRow
                    key={m.month}
                    label={m.month}
                    value={`earned ${formatInr(m.earned)} · due ${formatInr(m.due)} · held ${formatInr(m.held)} · paid ${formatInr(m.paid)}`}
                  />
                ))}
              </>
            ) : null}
            {earnings.reliabilityHoldPct > 0 ? (
              <Text style={styles.hint}>
                {earnings.reliabilityHoldPct}% held pending reliability review.
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.hint}>No earnings data yet.</Text>
        )}
      </View>

      <Btn label="Referral QR" onPress={() => router.push('/referral')} variant="secondary" />
      <Btn label="Sign out" onPress={() => void logout()} variant="secondary" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, gap: 8 },
  panel: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radius,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  hint: { fontSize: 12, color: tokens.textMuted, marginTop: 4 },
});
