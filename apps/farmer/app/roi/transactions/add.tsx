import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { tokens } from '@morbeez/shared';
import { Btn, Panel } from '@morbeez/ui-native';

export default function AddTransactionPickerScreen() {
  const router = useRouter();
  return (
    <View style={styles.wrap}>
      <Panel title="Add transaction">
        <Text style={styles.sub}>Choose transaction type</Text>
        <Btn label="Expense" onPress={() => router.push('/roi/transactions/add-expense')} />
        <Btn label="Income" variant="secondary" onPress={() => router.push('/roi/transactions/add-income')} />
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: tokens.bg },
  sub: { fontSize: 14, color: tokens.textMuted, marginBottom: 12 },
});
