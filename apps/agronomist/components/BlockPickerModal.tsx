import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { tokens, type AgronomistBlockRow } from '@morbeez/shared';
import { Btn } from '@morbeez/ui-native';

type Props = {
  visible: boolean;
  blocks: AgronomistBlockRow[];
  onSelect: (block: AgronomistBlockRow) => void;
  onClose: () => void;
};

export function BlockPickerModal({ visible, blocks, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Choose block for visit</Text>
          <Text style={styles.hint}>Structured visits are recorded per block.</Text>
          <ScrollView style={styles.list}>
            {blocks.map((block) => (
              <Pressable
                key={block.id}
                style={styles.row}
                onPress={() => onSelect(block)}
                accessibilityRole="button"
              >
                <Text style={styles.blockName}>{block.name}</Text>
                <Text style={styles.blockMeta}>
                  {[block.cropType, block.dap != null ? `DAP ${block.dap}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Btn label="Cancel" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: tokens.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '70%',
    gap: 8,
  },
  title: { fontSize: 18, fontWeight: '700', color: tokens.text },
  hint: { fontSize: 13, color: tokens.textMuted, lineHeight: 18 },
  list: { maxHeight: 320, marginVertical: 8 },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: tokens.border,
  },
  blockName: { fontSize: 16, fontWeight: '600', color: tokens.text },
  blockMeta: { fontSize: 13, color: tokens.textMuted, marginTop: 2 },
});
