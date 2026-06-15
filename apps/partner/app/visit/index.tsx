import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { partnerClient, tokens } from '@morbeez/shared';
import { AlertBox, Btn, Loading, Panel } from '@morbeez/ui-native';

export default function VisitStartScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    farmerId: string;
    farmerName?: string;
    blockId?: string;
  }>();
  const farmerId = String(params.farmerId ?? '');
  const farmerName = String(params.farmerName ?? 'Farmer');
  const blockId = params.blockId ? String(params.blockId) : undefined;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);

  const startSession = async () => {
    if (!farmerId) return;
    setBusy(true);
    setError('');
    try {
      let latitude: number | undefined;
      let longitude: number | undefined;
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({});
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      }
      const result = await partnerClient.startVisitSession({
        farmerId,
        blockId,
        latitude,
        longitude,
      });
      const id = String((result as Record<string, unknown>).id ?? '');
      setSessionId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start visit session');
    } finally {
      setBusy(false);
    }
  };

  if (!farmerId) return <AlertBox>Missing farmer ID. Open a farmer workspace first.</AlertBox>;

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Panel title={`Visit — ${farmerName}`}>
        <Text style={styles.hint}>
          Start a visit session when you arrive at the field. Partner field findings are submitted as
          draft only — staff agronomists complete the full Visit AI wizard and approve recommendations
          before farmer WhatsApp messages are sent.
        </Text>
        {blockId ? <Text style={styles.meta}>Block: {blockId}</Text> : null}
        {sessionId ? (
          <Text style={styles.active}>Session active ({sessionId.slice(0, 8)}…)</Text>
        ) : null}
        {busy ? <Loading label="Starting session…" /> : null}
        <Btn
          label={sessionId ? 'Session started' : 'Check in'}
          onPress={() => void startSession()}
          disabled={busy || Boolean(sessionId)}
        />
        <Btn
          label="Back to farmer"
          variant="secondary"
          onPress={() => router.push(`/farmer/${farmerId}`)}
        />
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg, padding: 16 },
  hint: { fontSize: 14, color: tokens.textMuted, lineHeight: 20, marginBottom: 12 },
  meta: { fontSize: 13, color: tokens.text, marginBottom: 8 },
  active: { fontSize: 13, color: tokens.green700, fontWeight: '600', marginBottom: 8 },
});
