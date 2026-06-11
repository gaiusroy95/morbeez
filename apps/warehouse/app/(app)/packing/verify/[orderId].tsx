import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { tokens, warehouseClient } from '@morbeez/shared';
import { AlertBox, Btn, Loading, Panel } from '@morbeez/ui-native';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { useStaffAuth } from '@/context/StaffAuth';

export default function LabelVerifyScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { canWrite } = useStaffAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [wrongLabel, setWrongLabel] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function verify(scanCode?: string) {
    const value = (scanCode ?? code).trim();
    if (!orderId || !value || !canWrite) return;
    setBusy(true);
    setWrongLabel('');
    setError('');
    try {
      const r = await warehouseClient.verifyLabel(orderId, value);
      if (r.matched) {
        setCode('');
        setMessage(r.message ?? 'Label verified — paste on parcel');
        router.replace(`/(app)/packing/print/${orderId}`);
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setWrongLabel(r.error ?? 'Wrong label — scan the next label from your tray');
      }
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setWrongLabel(e instanceof Error ? e.message : 'Label verification failed');
    } finally {
      setBusy(false);
    }
  }

  if (!orderId) return <Loading label="Loading…" />;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      {wrongLabel ? <AlertBox>{wrongLabel}</AlertBox> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <Panel title="Verify shipping label">
        <Text style={styles.hint}>
          Scan the QR on the label from your employee tray. Top label = first order in stack.
        </Text>
        <BarcodeScanner onScan={(c) => void verify(c)} disabled={busy} />
        <TextInput
          style={styles.input}
          placeholder="Scan label QR / barcode"
          placeholderTextColor={tokens.textMuted}
          value={code}
          onChangeText={setCode}
          onSubmitEditing={() => void verify()}
          autoCapitalize="none"
        />
        <Btn label="Verify label" onPress={() => void verify()} disabled={busy || !canWrite} />
      </Panel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  success: { color: tokens.green700, marginBottom: 8, fontSize: 14 },
  hint: { fontSize: 13, color: tokens.textMuted, marginBottom: 12 },
  input: {
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginVertical: 6,
    color: tokens.text,
  },
});
