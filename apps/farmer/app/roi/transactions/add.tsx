import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { t, tokens } from '@morbeez/shared';
import { Btn } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';

/** Legacy route — same two shortcuts as the ROI tab footer. */
export default function AddTransactionPickerScreen() {
  const router = useRouter();
  const { locale } = useLocale();

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.btn}>
          <Btn label={t('income', locale)} onPress={() => router.replace('/roi/transactions/add-income')} />
        </View>
        <View style={styles.btn}>
          <Btn
            label={t('expense', locale)}
            variant="secondary"
            onPress={() => router.replace('/roi/transactions/add-expense')}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: tokens.bg, justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1 },
});
