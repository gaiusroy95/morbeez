import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchRoiExpenseTypes, t, tokens, type RoiExpenseType } from '@morbeez/shared';
import { AlertBox, Loading } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';

export default function QuickExpenseTypeScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const [types, setTypes] = useState<RoiExpenseType[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchRoiExpenseTypes()
      .then(setTypes)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load types'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading label={t('loading', locale)} />;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Text style={styles.title}>{t('selectExpenseType', locale)}</Text>
      <View style={styles.grid}>
        {types.map((type) => (
          <Pressable
            key={type.id}
            style={[styles.tile, { backgroundColor: type.color ?? tokens.green100, borderColor: type.color ?? tokens.green500 }]}
            onPress={() => router.push({ pathname: '/roi/quick-expense/amount', params: { typeId: type.id, typeName: type.name, icon: type.icon ?? '💰' } })}
            accessibilityRole="button"
            accessibilityLabel={type.name}
          >
            <Text style={styles.tileIcon}>{type.icon ?? '💰'}</Text>
            <Text style={styles.tileLabel}>{type.name}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 20, fontWeight: '700', color: tokens.text, marginBottom: 16, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  tile: {
    width: '44%',
    minHeight: 110,
    borderRadius: tokens.radiusSm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  tileIcon: { fontSize: 36, marginBottom: 8 },
  tileLabel: { fontSize: 15, fontWeight: '700', color: tokens.text, textAlign: 'center' },
});
