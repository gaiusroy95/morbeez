import { StyleSheet, View } from 'react-native';
import { tokens } from '@morbeez/shared';
import { Btn, TextField } from '@morbeez/ui-native';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  sending?: boolean;
};

export function VisitAssistantComposer({
  value,
  onChangeText,
  onSend,
  disabled,
  sending,
}: Props) {
  return (
    <View style={styles.root}>
      <TextField
        label="Message"
        value={value}
        onChangeText={onChangeText}
        placeholder="Describe findings or ask for draft field changes…"
        multiline
        accessibilityLabel="Assistant message"
      />
      <Btn
        label={sending ? 'Sending…' : 'Send'}
        onPress={onSend}
        disabled={disabled || sending || !value.trim()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.border,
    paddingTop: 12,
    backgroundColor: tokens.bg,
  },
});
