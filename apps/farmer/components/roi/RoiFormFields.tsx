import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fetchRoiContext, tokens } from '@morbeez/shared';
import { TextField } from '@morbeez/ui-native';
import { useRoiFilter } from '@/context/RoiFilterContext';

export function useRoiFormContext(initialBlockId?: string) {
  const { filter } = useRoiFilter();
  const [crop, setCrop] = useState(filter.crop ?? '');
  const [blockId, setBlockId] = useState(initialBlockId ?? filter.blockId ?? '');
  const [blocks, setBlocks] = useState<Array<{ id: string; name: string; crop: string }>>([]);
  const [crops, setCrops] = useState<string[]>([]);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const f = initialBlockId ? { ...filter, blockId: initialBlockId } : filter;
    void fetchRoiContext(f).then((ctx) => {
      setCrop(ctx.crop ?? filter.crop ?? '');
      setBlockId(ctx.blockId ?? initialBlockId ?? '');
      setBlocks(ctx.blocksForCrop);
      const allCrops = [...new Set(ctx.blocksForCrop.map((b) => b.crop))];
      if (ctx.crop && !allCrops.includes(ctx.crop)) allCrops.unshift(ctx.crop);
      setCrops(allCrops.length ? allCrops : ctx.crop ? [ctx.crop] : []);
    });
  }, [filter, initialBlockId]);

  async function onCropChange(nextCrop: string) {
    setCrop(nextCrop);
    const ctx = await fetchRoiContext({ crop: nextCrop, blockId: null });
    setBlocks(ctx.blocksForCrop);
    setBlockId(ctx.blockId ?? ctx.blocksForCrop[0]?.id ?? '');
  }

  return { crop, blockId, blocks, crops, entryDate, setEntryDate, setBlockId, onCropChange };
}

export function RoiFormPickers({
  crop,
  blockId,
  blocks,
  crops,
  entryDate,
  cropLabel,
  blockLabel,
  dateLabel,
  onCropChange,
  onBlockChange,
  onDateChange,
}: {
  crop: string;
  blockId: string;
  blocks: Array<{ id: string; name: string }>;
  crops: string[];
  entryDate: string;
  cropLabel: string;
  blockLabel: string;
  dateLabel: string;
  onCropChange: (crop: string) => void;
  onBlockChange: (id: string) => void;
  onDateChange: (d: string) => void;
}) {
  return (
    <>
      {crops.length > 1 ? (
        <>
          <Text style={styles.label}>{cropLabel}</Text>
          <View style={styles.chips}>
            {crops.map((c) => (
              <Pressable
                key={c}
                style={[styles.chip, crop === c && styles.chipOn]}
                onPress={() => void onCropChange(c)}
              >
                <Text>{c.charAt(0).toUpperCase() + c.slice(1)}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
      <Text style={styles.label}>{blockLabel}</Text>
      <View style={styles.chips}>
        {blocks.map((b) => (
          <Pressable key={b.id} style={[styles.chip, blockId === b.id && styles.chipOn]} onPress={() => onBlockChange(b.id)}>
            <Text>{b.name}</Text>
          </Pressable>
        ))}
      </View>
      <TextField label={dateLabel} value={entryDate} onChangeText={onDateChange} placeholder="YYYY-MM-DD" />
    </>
  );
}

export function StickySaveBar({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <View style={styles.footer}>
      <Pressable style={[styles.saveBtn, disabled ? styles.saveDisabled : null]} onPress={onPress} disabled={disabled}>
        <Text style={styles.saveText}>{label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: tokens.text, marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: tokens.green100 },
  chipOn: { backgroundColor: tokens.green500 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: tokens.border,
    backgroundColor: tokens.bg,
  },
  saveBtn: {
    backgroundColor: tokens.green700,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveDisabled: { opacity: 0.5 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
