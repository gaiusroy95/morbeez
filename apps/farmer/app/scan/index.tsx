import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { fetchFieldBlocks, runAiScan, t, tokens, type FieldBlock } from '@morbeez/shared';
import { AlertBox, Btn, HubTabs, Loading, Panel } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';

type ScanType = 'leaf' | 'field' | 'rhizome';

export default function ScanUploadScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const [blocks, setBlocks] = useState<FieldBlock[]>([]);
  const [scanType, setScanType] = useState<ScanType>('leaf');
  const [blockId, setBlockId] = useState<string | undefined>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    void fetchFieldBlocks()
      .then((b) => {
        setBlocks(b);
        setBlockId(b.find((x) => x.isPrimary)?.id ?? b[0]?.id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load fields'))
      .finally(() => setLoading(false));
  }, []);

  async function pickAndScan(useCamera: boolean) {
    setError('');
    const pick = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, base64: true });
    if (pick.canceled || !pick.assets[0]?.base64) return;

    setScanning(true);
    try {
      const result = await runAiScan({
        blockId,
        scanType,
        imageData: pick.assets[0].base64,
        mimeType: pick.assets[0].mimeType ?? 'image/jpeg',
      });
      router.push(`/scan/${result.sessionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }

  if (loading) return <Loading label={t('loading', locale)} />;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}

      <Panel title={t('scan', locale)}>
        <HubTabs
          tabs={[
            { id: 'leaf' as ScanType, label: 'Leaf' },
            { id: 'field' as ScanType, label: 'Whole plant' },
            { id: 'rhizome' as ScanType, label: 'Bed' },
          ]}
          active={scanType}
          onChange={setScanType}
        />
      </Panel>

      {blocks.length ? (
        <Panel title={t('fields', locale)}>
          <HubTabs tabs={blocks.map((b) => ({ id: b.id, label: b.name }))} active={blockId ?? blocks[0].id} onChange={setBlockId} />
        </Panel>
      ) : null}

      <Panel title="Tips for best results">
        <Text style={styles.tip}>• Use natural daylight</Text>
        <Text style={styles.tip}>• Fill the frame with the affected leaf</Text>
        <Text style={styles.tip}>• Avoid blur and heavy shadows</Text>
      </Panel>

      <Btn label={scanning ? t('loading', locale) : 'Take photo'} onPress={() => void pickAndScan(true)} disabled={scanning} />
      <Btn label="Choose from gallery" variant="secondary" onPress={() => void pickAndScan(false)} disabled={scanning} />
      <Btn label={t('scanHistory', locale)} variant="secondary" onPress={() => router.push('/scan/history')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32, gap: 8 },
  tip: { fontSize: 14, color: tokens.text, marginBottom: 4 },
});
