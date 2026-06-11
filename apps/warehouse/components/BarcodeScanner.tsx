import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { tokens } from '@morbeez/shared';
import { Btn } from '@morbeez/ui-native';

type Props = {
  onScan: (code: string) => void;
  disabled?: boolean;
  hint?: string;
};

export function BarcodeScanner({ onScan, disabled, hint }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [active, setActive] = useState(false);
  const lastCode = useRef('');
  const lastAt = useRef(0);

  const handleBarcode = useCallback(
    (result: { data: string }) => {
      if (disabled) return;
      const code = result.data?.trim();
      if (!code) return;
      const now = Date.now();
      if (code === lastCode.current && now - lastAt.current < 1500) return;
      lastCode.current = code;
      lastAt.current = now;
      onScan(code);
    },
    [disabled, onScan]
  );

  useEffect(() => {
    if (active && !permission?.granted) void requestPermission();
  }, [active, permission?.granted, requestPermission]);

  if (!active) {
    return (
      <View style={styles.wrap}>
        <Btn label="Open camera scanner" onPress={() => setActive(true)} variant="secondary" disabled={disabled} />
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
    );
  }

  if (!permission?.granted) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.hint}>Camera permission is required for barcode scanning.</Text>
        <Btn label="Allow camera" onPress={() => void requestPermission()} />
        <Btn label="Close scanner" onPress={() => setActive(false)} variant="secondary" />
      </View>
    );
  }

  return (
    <View style={styles.scannerBox}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'],
        }}
        onBarcodeScanned={handleBarcode}
      />
      <View style={styles.frame} pointerEvents="none" />
      <Btn label="Close scanner" onPress={() => setActive(false)} variant="secondary" />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginVertical: 8 },
  scannerBox: { gap: 8, marginVertical: 8 },
  camera: { height: 220, borderRadius: tokens.radiusSm, overflow: 'hidden' },
  frame: {
    position: 'absolute',
    top: 40,
    left: 24,
    right: 24,
    height: 140,
    borderWidth: 2,
    borderColor: tokens.green500,
    borderRadius: tokens.radiusSm,
    backgroundColor: 'transparent',
  },
  hint: { fontSize: 12, color: tokens.textMuted },
});
