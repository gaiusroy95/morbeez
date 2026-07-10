import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { telecallerClient, tokens, type TelecallerLeadRow, formatPhoneDisplay, telHref } from '@morbeez/shared';
import { AlertBox, Loading } from '@morbeez/ui-native';

export default function LeadsScreen() {
  const router = useRouter();
  const [leads, setLeads] = useState<TelecallerLeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const rows = await telecallerClient.listLeads({ scope: 'mine', limit: 50 });
      setLeads(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leads');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !leads.length) return <Loading label="Loading leads…" />;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
    >
      {error ? <AlertBox>{error}</AlertBox> : null}
      {leads.map((lead) => (
        <Pressable
          key={lead.id}
          style={styles.card}
          onPress={() => router.push(`/lead/${lead.id}`)}
        >
          <View style={styles.row}>
            <Text style={styles.name}>{lead.farmerName}</Text>
            <Text style={styles.stage}>{lead.stageLabel}</Text>
          </View>
          <Text style={styles.meta}>
            {lead.district ?? '—'} · {lead.lastInteractionLabel ?? 'No recent contact'}
          </Text>
          {lead.phone ? (
            <Pressable
              onPress={() => {
                const href = telHref(lead.phone);
                if (href) void Linking.openURL(href);
              }}
              style={styles.callLink}
            >
              <Text style={styles.callText}>Call {formatPhoneDisplay(lead.phone)}</Text>
            </Pressable>
          ) : null}
        </Pressable>
      ))}
      {!leads.length ? <Text style={styles.empty}>No leads assigned.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.border,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  name: { fontSize: 16, fontWeight: '600', color: tokens.text, flex: 1 },
  stage: { fontSize: 12, color: tokens.green700, fontWeight: '600' },
  meta: { marginTop: 4, fontSize: 13, color: tokens.textMuted },
  callLink: { marginTop: 8 },
  callText: { color: tokens.green700, fontWeight: '600' },
  empty: { textAlign: 'center', color: tokens.textMuted, marginTop: 24 },
});
