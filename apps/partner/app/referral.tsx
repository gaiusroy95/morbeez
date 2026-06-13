import { Image, ScrollView, StyleSheet, Text } from 'react-native';
import { useEffect, useState } from 'react';
import { partnerClient, tokens } from '@morbeez/shared';
import { AlertBox, Loading, Panel } from '@morbeez/ui-native';

export default function ReferralScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [url, setUrl] = useState('');
  const [qrToken, setQrToken] = useState('');

  useEffect(() => {
    void partnerClient
      .getReferral()
      .then((r) => {
        setCode(r.partnerCode);
        setUrl(r.referralUrl);
        setQrToken(r.qrToken ?? r.partnerCode);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load referral'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading label="Loading referral…" />;

  const qrPayload = url || qrToken || code;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Panel title="Partner code">
        <Text style={styles.code}>{code}</Text>
      </Panel>
      <Panel title="Enrollment QR">
        {qrPayload ? (
          <Image
            accessibilityLabel="Partner enrollment QR code"
            source={{
              uri: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrPayload)}`,
            }}
            style={styles.qr}
          />
        ) : null}
        <Text style={styles.qrNote}>
          Farmers scan this QR at meetings for automatic partner attribution.
        </Text>
      </Panel>
      <Panel title="Referral link">
        <Text style={styles.url}>{url}</Text>
        <Text style={styles.hint}>Share this link or display the QR at farmer meetings.</Text>
      </Panel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, gap: 8 },
  code: { fontSize: 20, fontWeight: '700', color: tokens.green700 },
  url: { fontSize: 13, color: tokens.text },
  hint: { fontSize: 12, color: tokens.textMuted, marginTop: 8 },
  qrNote: { fontSize: 13, color: tokens.textMuted, marginTop: 12, lineHeight: 20 },
  qr: { width: 220, height: 220, alignSelf: 'center', marginVertical: 12 },
});
