import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { tokens } from '@morbeez/shared';
import { Btn } from '@morbeez/ui-native';

type Props = {
  onScan: (code: string) => void;
  disabled?: boolean;
  hint?: string;
  /** Hide built-in trigger — parent opens camera via `open` */
  hideTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function BarcodeScanner({
  onScan,
  disabled,
  hint,
  hideTrigger = false,
  open,
  onOpenChange,
}: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [internalOpen, setInternalOpen] = useState(false);
  const lastCode = useRef('');
  const lastAt = useRef(0);

  const active = open ?? internalOpen;
  const setActive = useCallback(
    (next: boolean) => {
      onOpenChange?.(next);
      if (open === undefined) setInternalOpen(next);
    },
    [onOpenChange, open]
  );

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
      setActive(false);
    },
    [disabled, onScan, setActive]
  );

  useEffect(() => {
    if (active && !permission?.granted) void requestPermission();
  }, [active, permission?.granted, requestPermission]);

  const cameraBody = !permission?.granted ? (
    <View style={styles.modalInner}>
      <Text style={styles.hint}>Camera permission is required for barcode scanning.</Text>
      <Btn label="Allow camera" onPress={() => void requestPermission()} />
      <Btn label="Close scanner" onPress={() => setActive(false)} variant="secondary" />
    </View>
  ) : (
    <View style={styles.modalInner}>
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

  return (
    <>
      {!hideTrigger ? (
        <View style={styles.wrap}>
          <Btn
            label="Open camera scanner"
            onPress={() => setActive(true)}
            variant="secondary"
            disabled={disabled}
          />
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
      ) : null}

      <Modal visible={active} animationType="slide" onRequestClose={() => setActive(false)}>
        <View style={styles.modal}>{cameraBody}</View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginVertical: 8 },
  modal: { flex: 1, backgroundColor: tokens.bg, paddingTop: 48, paddingHorizontal: 16 },
  modalInner: { flex: 1, gap: 12 },
  camera: { flex: 1, borderRadius: tokens.radiusSm, overflow: 'hidden', minHeight: 280 },
  frame: {
    position: 'absolute',
    top: 80,
    left: 24,
    right: 24,
    height: 180,
    borderWidth: 2,
    borderColor: tokens.green500,
    borderRadius: tokens.radiusSm,
  },
  hint: { fontSize: 12, color: tokens.textMuted, textAlign: 'center' },
});
