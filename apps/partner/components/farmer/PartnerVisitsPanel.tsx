import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDate, partnerClient, tokens, type PartnerVisitRow, type PartnerVisitSessionRow } from '@morbeez/shared';
import { AlertBox, Btn, ListCard, Loading, Panel } from '@morbeez/ui-native';

type Props = {
  farmerId: string;
  farmerName: string;
  recentVisits?: PartnerVisitRow[];
};

export function PartnerVisitsPanel({ farmerId, farmerName, recentVisits = [] }: Props) {
  const router = useRouter();
  const [sessions, setSessions] = useState<PartnerVisitSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setSessions(await partnerClient.getVisitSessions(farmerId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load visits');
    } finally {
      setLoading(false);
    }
  }, [farmerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const inProgress = sessions.filter((s) => s.status === 'in_progress');
  const completed = recentVisits;

  if (loading) return <Loading label="Loading visits…" />;

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Panel title="In progress">
        {inProgress.length ? (
          inProgress.map((s) => (
            <ListCard
              key={s.id}
              title="Active visit session"
              subtitle={`Checked in ${formatDate(s.checkInAt)}`}
              onPress={() =>
                router.push(`/visit?farmerId=${farmerId}&farmerName=${encodeURIComponent(farmerName)}&blockId=${s.blockId ?? ''}&sessionId=${s.id}`)
              }
            />
          ))
        ) : (
          <Text style={styles.empty}>No active sessions.</Text>
        )}
      </Panel>
      <Panel title="Completed">
        {completed.map((v) => (
          <ListCard
            key={v.id}
            title={v.summary ?? 'Visit'}
            subtitle={formatDate(v.visitedAt)}
            onPress={() => router.push(`/visit/detail/${v.id}?farmerId=${farmerId}`)}
          />
        ))}
        {!completed.length ? <Text style={styles.empty}>No completed visits yet.</Text> : null}
      </Panel>
      <Btn
        label="Start new visit"
        onPress={() => router.push(`/visit?farmerId=${farmerId}&farmerName=${encodeURIComponent(farmerName)}`)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  empty: { color: tokens.textMuted, fontSize: 13, paddingVertical: 4 },
});
