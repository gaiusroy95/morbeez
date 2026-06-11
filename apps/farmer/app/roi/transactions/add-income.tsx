import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatInr, recordHarvestSale, recordIncome, tokens } from '@morbeez/shared';
import { AlertBox, HubTabs, TextField } from '@morbeez/ui-native';
import { RoiFormPickers, StickySaveBar, useRoiFormContext } from '@/components/roi/RoiFormFields';

export default function AddIncomeScreen() {
  const router = useRouter();
  const { crop, blockId, blocks, crops, entryDate, setEntryDate, setBlockId, onCropChange } = useRoiFormContext();
  const [subtype, setSubtype] = useState<'harvest_sale' | 'advance' | 'subsidy' | 'other'>('harvest_sale');
  const [yieldKg, setYieldKg] = useState('');
  const [rate, setRate] = useState('');
  const [buyer, setBuyer] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const harvestTotal = useMemo(() => {
    const y = Number(yieldKg);
    const p = Number(rate);
    if (!y || !p) return 0;
    return Math.round(y * p * 100) / 100;
  }, [yieldKg, rate]);

  async function save() {
    if (!blockId) {
      setError('Select a block');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (subtype === 'harvest_sale') {
        const y = Number(yieldKg);
        const p = Number(rate);
        if (!y || !p) throw new Error('Enter quantity and rate');
        await recordHarvestSale({
          blockId,
          yieldKg: y,
          sellingPricePerKg: p,
          buyer: buyer.trim() || undefined,
          harvestDate: entryDate,
        });
      } else {
        const amt = Number(amount);
        if (!amt) throw new Error('Enter amount');
        await recordIncome({
          blockId,
          incomeSubtype: subtype,
          amount: amt,
          entryDate,
          note: note.trim() || undefined,
        });
      }
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {error ? <AlertBox>{error}</AlertBox> : null}
        <HubTabs
          tabs={[
            { id: 'harvest_sale', label: 'Harvest Sale' },
            { id: 'advance', label: 'Advance' },
            { id: 'subsidy', label: 'Subsidy' },
            { id: 'other', label: 'Other' },
          ]}
          active={subtype}
          onChange={(id) => setSubtype(id as typeof subtype)}
        />
        <RoiFormPickers
          crop={crop}
          blockId={blockId}
          blocks={blocks}
          crops={crops}
          entryDate={entryDate}
          cropLabel="Crop"
          blockLabel="Block"
          dateLabel="Date"
          onCropChange={(c) => void onCropChange(c)}
          onBlockChange={setBlockId}
          onDateChange={setEntryDate}
        />
        {subtype === 'harvest_sale' ? (
          <>
            <TextField label="Quantity (kg)" value={yieldKg} onChangeText={setYieldKg} keyboardType="decimal-pad" />
            <TextField label="Rate (₹/kg)" value={rate} onChangeText={setRate} keyboardType="decimal-pad" />
            <TextField label="Buyer (optional)" value={buyer} onChangeText={setBuyer} />
            {harvestTotal > 0 ? <Text style={styles.total}>Total: {formatInr(harvestTotal)}</Text> : null}
          </>
        ) : (
          <>
            <TextField label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
            <TextField label="Note" value={note} onChangeText={setNote} />
          </>
        )}
      </ScrollView>
      <StickySaveBar label={saving ? 'Saving…' : 'Save income'} onPress={() => void save()} disabled={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 100, gap: 10 },
  total: { fontSize: 18, fontWeight: '700', color: tokens.green800 },
});
