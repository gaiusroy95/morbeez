import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatInr, tokens } from '@morbeez/shared';
import { Btn, PasswordField } from '@morbeez/ui-native';

type Step = 'summary' | 'confirm' | 'success';

export function FinishCycleFlow({
  visible,
  onClose,
  onFinish,
  crop,
  blockName,
  dap,
  expenseInr,
  incomeInr,
  profitInr,
  requiresPassword,
  busy,
}: {
  visible: boolean;
  onClose: () => void;
  onFinish: (opts: { password?: string; confirmText: string }) => Promise<void>;
  crop: string;
  blockName: string;
  dap: number | null;
  expenseInr: number;
  incomeInr: number;
  profitInr: number | null;
  requiresPassword: boolean;
  busy: boolean;
}) {
  const [step, setStep] = useState<Step>('summary');
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');

  function reset() {
    setStep('summary');
    setPassword('');
    setConfirmText('');
    setError('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function submitConfirm() {
    if (confirmText.trim().toUpperCase() !== 'COMPLETE') {
      setError('Type COMPLETE to confirm');
      return;
    }
    setError('');
    try {
      await onFinish({ password: password.trim() || undefined, confirmText: confirmText.trim() });
      setStep('success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not finish cycle');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {step === 'summary' ? (
            <>
              <Text style={styles.title}>Complete crop cycle</Text>
              <Text style={styles.sub}>
                {crop} · {blockName}
                {dap != null ? ` · DAP ${dap}` : ''}
              </Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Expense</Text>
                <Text style={styles.summaryValue}>{formatInr(expenseInr)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Income</Text>
                <Text style={styles.summaryValue}>{formatInr(incomeInr)}</Text>
              </View>
              {profitInr != null ? (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Net profit</Text>
                  <Text style={[styles.summaryValue, styles.profit]}>{formatInr(profitInr)}</Text>
                </View>
              ) : null}
              {requiresPassword ? (
                <PasswordField label="Enter password" value={password} onChangeText={setPassword} />
              ) : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.actions}>
                <Btn label="Cancel" variant="secondary" onPress={handleClose} />
                <Btn label="Continue" onPress={() => setStep('confirm')} />
              </View>
            </>
          ) : null}

          {step === 'confirm' ? (
            <>
              <Text style={styles.title}>Confirm action</Text>
              <Text style={styles.warn}>This action cannot be undone. Type COMPLETE to confirm.</Text>
              <TextInput
                style={styles.input}
                value={confirmText}
                onChangeText={setConfirmText}
                placeholder="COMPLETE"
                autoCapitalize="characters"
                placeholderTextColor={tokens.textMuted}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.actions}>
                <Btn label="Cancel" variant="secondary" onPress={() => setStep('summary')} />
                <Btn label={busy ? 'Finishing…' : 'Confirm'} onPress={() => void submitConfirm()} disabled={busy} />
              </View>
            </>
          ) : null}

          {step === 'success' ? (
            <>
              <Text style={styles.successIcon}>✓</Text>
              <Text style={styles.title}>Crop cycle completed</Text>
              <Text style={styles.sub}>Moved to history · ROI generated · Reports locked</Text>
              <Btn
                label="Done"
                onPress={() => {
                  handleClose();
                }}
              />
            </>
          ) : null}

          {step !== 'success' ? (
            <Pressable style={styles.closeX} onPress={handleClose}>
              <Text style={styles.closeXText}>✕</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: tokens.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 28,
  },
  title: { fontSize: 20, fontWeight: '800', color: tokens.text, marginBottom: 8 },
  sub: { fontSize: 14, color: tokens.textMuted, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 14, color: tokens.textMuted },
  summaryValue: { fontSize: 14, fontWeight: '700', color: tokens.text },
  profit: { color: tokens.green800 },
  warn: { fontSize: 14, color: '#B45309', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: tokens.text,
    marginBottom: 12,
  },
  error: { color: tokens.danger, fontSize: 13, marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  successIcon: { fontSize: 48, color: tokens.green700, textAlign: 'center', marginBottom: 8 },
  closeX: { position: 'absolute', top: 16, right: 16, padding: 8 },
  closeXText: { fontSize: 18, color: tokens.textMuted },
});
