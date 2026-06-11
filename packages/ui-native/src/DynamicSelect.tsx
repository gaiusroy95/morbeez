import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { tokens } from '@morbeez/shared';

export type DynamicSelectOption = {
  key: string;
  value: string;
  label: string;
};

type Props = {
  label?: string;
  placeholder?: string;
  value: string;
  options: DynamicSelectOption[];
  disabled?: boolean;
  loading?: boolean;
  allowAdd?: boolean;
  addPlaceholder?: string;
  addButtonLabel?: string;
  onChange: (value: string, option: DynamicSelectOption | null) => void;
  onAdd?: (name: string) => Promise<void>;
};

function filterOptions(options: DynamicSelectOption[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) => o.label.toLowerCase().includes(q));
}

export function DynamicSelect({
  label,
  placeholder = 'Select…',
  value,
  options,
  disabled,
  loading,
  allowAdd = false,
  addPlaceholder = 'New name',
  addButtonLabel = 'Add',
  onChange,
  onAdd,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [addName, setAddName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const filtered = useMemo(() => filterOptions(options, search), [options, search]);
  const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);
  const triggerLabel = selected?.label ?? placeholder;

  async function handleAdd() {
    if (!onAdd || !addName.trim()) return;
    setBusy(true);
    setError('');
    try {
      await onAdd(addName.trim());
      setAddName('');
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add');
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setOpen(false);
    setSearch('');
    setError('');
  }

  return (
    <View style={styles.root}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        style={[styles.trigger, (disabled || loading) && styles.triggerDisabled]}
        onPress={() => setOpen(true)}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={label ?? 'Select option'}
      >
        <Text style={[styles.triggerText, !selected && styles.triggerPlaceholder]}>
          {loading ? 'Loading…' : triggerLabel}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label ?? 'Select'}</Text>
              <Pressable onPress={close} hitSlop={8}>
                <Text style={styles.closeBtn}>Close</Text>
              </Pressable>
            </View>

            <View style={styles.searchWrap}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search"
                placeholderTextColor={tokens.textMuted}
                value={search}
                onChangeText={setSearch}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(item) => item.key}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              ListEmptyComponent={<Text style={styles.empty}>No options match your search.</Text>}
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <Pressable
                    style={[styles.row, active && styles.rowActive]}
                    onPress={() => {
                      onChange(item.value, item);
                      close();
                    }}
                  >
                    <Text style={[styles.rowText, active && styles.rowTextActive]}>{item.label}</Text>
                    {active ? <Text style={styles.check}>✓</Text> : null}
                  </Pressable>
                );
              }}
            />

            {allowAdd && onAdd ? (
              <View style={styles.footer}>
                <TextInput
                  style={styles.addInput}
                  placeholder={addPlaceholder}
                  placeholderTextColor={tokens.textMuted}
                  value={addName}
                  onChangeText={setAddName}
                  autoCapitalize="words"
                  editable={!busy}
                />
                <Pressable
                  style={[styles.addBtn, (busy || !addName.trim()) && styles.addBtnDisabled]}
                  onPress={() => void handleAdd()}
                  disabled={busy || !addName.trim()}
                >
                  <Text style={styles.addBtnText}>{addButtonLabel}</Text>
                </Pressable>
              </View>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: tokens.spacing.md },
  label: { fontSize: 13, fontWeight: '600', color: tokens.text, marginBottom: 6 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  triggerDisabled: { opacity: 0.55 },
  triggerText: { fontSize: 15, color: tokens.text, flex: 1 },
  triggerPlaceholder: { color: tokens.textMuted },
  chevron: { fontSize: 14, color: tokens.textMuted, marginLeft: 8 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '78%',
    backgroundColor: tokens.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: tokens.text },
  closeBtn: { fontSize: 14, fontWeight: '600', color: tokens.green700 },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  searchInput: {
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: tokens.text,
  },
  list: { maxHeight: 280 },
  empty: { textAlign: 'center', color: tokens.textMuted, padding: 20, fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.border,
  },
  rowActive: { backgroundColor: tokens.green100 },
  rowText: { fontSize: 15, color: tokens.text, flex: 1 },
  rowTextActive: { fontWeight: '700', color: tokens.green800 },
  check: { fontSize: 16, color: tokens.green700, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: tokens.border,
  },
  addInput: {
    flex: 1,
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: tokens.text,
  },
  addBtn: {
    backgroundColor: tokens.green700,
    borderRadius: tokens.radiusSm,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  addBtnDisabled: { opacity: 0.5 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  error: { color: tokens.danger, fontSize: 13, paddingHorizontal: 16, paddingTop: 8 },
});
