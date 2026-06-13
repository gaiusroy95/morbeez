import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { partnerClient, tokens, type PartnerEarningsSummary } from '@morbeez/shared';
import { AlertBox, Btn, KeyValueRow, Loading, Panel } from '@morbeez/ui-native';
import { usePartnerAuth } from '@/context/PartnerAuth';

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function ProfileScreen() {
  const { partner, logout } = usePartnerAuth();
  const router = useRouter();
  const [earnings, setEarnings] = useState<PartnerEarningsSummary | null>(null);
  const [loadingEarnings, setLoadingEarnings] = useState(true);
  const [error, setError] = useState('');

  const loadEarnings = useCallback(async () => {
    setError('');
    try {
      const summary = await partnerClient.getEarningsSummary();
      setEarnings({
        month: String(summary.month ?? ''),
        serviceRevenue: Number(summary.serviceRevenue ?? 0),
        productCommission: Number(summary.productCommission ?? 0),
        leadBonus: Number(summary.leadBonus ?? 0),
        successBonus: Number(summary.successBonus ?? 0),
        pendingPayout: Number(summary.pendingPayout ?? 0),
        approvedPayout: Number(summary.approvedPayout ?? 0),
        paidPayout: Number(summary.paidPayout ?? 0),
        reliabilityHoldPct: Number(summary.reliabilityHoldPct ?? 0),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load earnings');
    } finally {
      setLoadingEarnings(false);
    }
  }, []);

  useEffect(() => {
    void loadEarnings();
  }, [loadEarnings]);

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

      <Panel title="Earnings summary">
        {loadingEarnings ? (
          <Loading label="Loading earnings…" />
        ) : earnings ? (
          <>
            <KeyValueRow label="Month" value={earnings.month || '—'} />
            <KeyValueRow label="Service revenue" value={formatInr(earnings.serviceRevenue)} />
            <KeyValueRow label="Product commission" value={formatInr(earnings.productCommission)} />
            <KeyValueRow label="Lead bonus" value={formatInr(earnings.leadBonus)} />
            <KeyValueRow label="Success bonus" value={formatInr(earnings.successBonus)} />
            <KeyValueRow label="Pending payout" value={formatInr(earnings.pendingPayout)} />
            <KeyValueRow label="Approved payout" value={formatInr(earnings.approvedPayout)} />
            <KeyValueRow label="Paid payout" value={formatInr(earnings.paidPayout)} />
            {earnings.reliabilityHoldPct > 0 ? (
              <Text style={styles.hint}>
                {earnings.reliabilityHoldPct}% held pending reliability review.
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.hint}>No earnings data yet.</Text>
        )}
      </Panel>

      <Btn label="Referral QR" onPress={() => router.push('/referral')} variant="secondary" />
      <Btn label="Sign out" onPress={() => void logout()} variant="secondary" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, gap: 8 },
  hint: { fontSize: 12, color: tokens.textMuted, marginTop: 4 },
});
