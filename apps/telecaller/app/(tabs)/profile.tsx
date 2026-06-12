import { StyleSheet, Text, View } from 'react-native';
import { t, tokens } from '@morbeez/shared';
import { Btn } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';
import { useStaffAuth } from '@/context/StaffAuth';

export default function ProfileScreen() {
  const { admin, logout } = useStaffAuth();
  const { locale } = useLocale();

  return (
    <View style={styles.root}>
      <Text style={styles.name}>{admin?.fullName ?? admin?.email ?? 'Telecaller'}</Text>
      <Text style={styles.email}>{admin?.email}</Text>
      <Btn label={t('logout', locale)} onPress={() => void logout()} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, backgroundColor: tokens.bg, gap: 12 },
  name: { fontSize: 20, fontWeight: '700', color: tokens.text },
  email: { fontSize: 14, color: tokens.textMuted, marginBottom: 12 },
});
