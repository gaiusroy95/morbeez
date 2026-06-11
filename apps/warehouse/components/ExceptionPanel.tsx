import { StyleSheet, View } from 'react-native';
import { warehouseClient } from '@morbeez/shared';
import { Btn, Panel } from '@morbeez/ui-native';
import { EXCEPTIONS } from './exceptions';

type Props = {
  orderId: string;
  canWrite: boolean;
  busy: boolean;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
  setBusy: (v: boolean) => void;
};

export function ExceptionPanel({ orderId, canWrite, busy, onDone, onError, setBusy }: Props) {
  if (!canWrite) return null;

  async function report(type: string) {
    setBusy(true);
    try {
      await warehouseClient.reportException(orderId, type, `Reported from mobile: ${type}`);
      onDone('Exception logged');
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Exception failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Exceptions">
      <View style={styles.row}>
        {EXCEPTIONS.map((ex) => (
          <Btn
            key={ex.type}
            label={ex.label}
            onPress={() => void report(ex.type)}
            disabled={busy}
            variant="secondary"
          />
        ))}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8 },
});
