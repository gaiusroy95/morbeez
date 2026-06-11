import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { warehouseClient } from '@morbeez/shared';
import { AlertBox, Btn } from '@morbeez/ui-native';
import { buildDocumentHtml, type PrintDocType } from '@/lib/document-html';

type Props = {
  docType: PrintDocType;
  entityId: string;
};

export function DocumentPrintViewer({ docType, entityId }: Props) {
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const data = await warehouseClient.fetchDocument(docType, entityId);
      setHtml(buildDocumentHtml(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Document not found');
    } finally {
      setLoading(false);
    }
  }, [docType, entityId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function printDoc() {
    if (!html) return;
    setBusy(true);
    try {
      await Print.printAsync({ html });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Print failed');
    } finally {
      setBusy(false);
    }
  }

  async function sharePdf() {
    if (!html) return;
    setBusy(true);
    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share document' });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Share failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.wrap}>
        <AlertBox>{error}</AlertBox>
        <Btn label="Retry" onPress={() => void load()} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.toolbar}>
        <Btn label={busy ? '…' : 'Print'} onPress={printDoc} disabled={busy} />
        <Btn label="Share PDF" onPress={sharePdf} disabled={busy} variant="secondary" />
      </View>
      <WebView originWhitelist={['*']} source={{ html }} style={styles.web} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  toolbar: { flexDirection: 'row', gap: 8, padding: 12 },
  web: { flex: 1 },
});
