import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { tokens, type VisitAssistantMessage } from '@morbeez/shared';

type Props = {
  messages: VisitAssistantMessage[];
};

export function VisitAssistantMessages({ messages }: Props) {
  if (!messages.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          Describe the visit in chat. Proposed field changes appear below for review before they
          update the wizard.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.list} contentContainerStyle={styles.content}>
      {messages.map((message) => (
        <View
          key={message.id}
          style={[
            styles.bubble,
            message.role === 'agronomist' && styles.agronomist,
            message.role === 'assistant' && styles.assistant,
            message.role === 'system' && styles.system,
          ]}
        >
          <Text style={styles.role}>{message.role}</Text>
          <Text style={styles.body}>{message.content}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { gap: 8, paddingVertical: 8 },
  empty: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: tokens.textMuted,
  },
  bubble: {
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 10,
    backgroundColor: tokens.card,
  },
  agronomist: {
    alignSelf: 'flex-end',
    maxWidth: '92%',
    backgroundColor: tokens.green50,
    borderColor: tokens.green700,
  },
  assistant: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
  },
  system: {
    alignSelf: 'stretch',
    backgroundColor: tokens.warningBg,
  },
  role: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: tokens.text,
  },
});
