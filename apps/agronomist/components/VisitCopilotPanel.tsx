import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { agronomistClient, tokens } from '@morbeez/shared';
import { Btn, Panel } from '@morbeez/ui-native';

type Props = {
  farmerId: string;
  blockId: string;
  cropType: string;
  issueName?: string;
  aiCaseId?: string;
};

export function VisitCopilotPanel({ farmerId, blockId, cropType, issueName, aiCaseId }: Props) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  async function ask() {
    if (!question.trim()) return;
    setLoading(true);
    try {
      const r = await agronomistClient.copilotAsk({
        question: question.trim(),
        farmerId,
        blockId,
        cropType,
        issueName,
        aiCaseId,
      });
      setAnswer(r.answer);
    } catch (e) {
      setAnswer(e instanceof Error ? e.message : 'Copilot failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel title="Copilot">
      <TextInput
        style={styles.input}
        value={question}
        onChangeText={setQuestion}
        placeholder="Ask about this field visit…"
        multiline
      />
      <View style={styles.actions}>
        <Btn label={loading ? 'Thinking…' : 'Ask'} onPress={() => void ask()} disabled={loading || !question.trim()} />
        {aiCaseId ? (
          <Btn
            label="Why diagnosis?"
            variant="secondary"
            onPress={() => {
              if (!aiCaseId) return;
              setLoading(true);
              void agronomistClient
                .whyDiagnosis(aiCaseId)
                .then((r) => setAnswer(r.answer))
                .catch((e) => setAnswer(e instanceof Error ? e.message : 'Failed'))
                .finally(() => setLoading(false));
            }}
            disabled={loading}
          />
        ) : null}
      </View>
      {answer ? <Text style={styles.answer}>{answer}</Text> : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radius,
    padding: 10,
    minHeight: 72,
    fontSize: 14,
    color: tokens.text,
    backgroundColor: tokens.card,
  },
  actions: { marginTop: 8 },
  answer: { marginTop: 12, fontSize: 14, lineHeight: 20, color: tokens.text },
});
