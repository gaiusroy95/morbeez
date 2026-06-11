import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchPortalProfile, t, tokens } from '@morbeez/shared';
import { Btn, KeyValueRow, Panel } from '@morbeez/ui-native';
import { WhatsAppBtn } from '@/components/PortalHelpers';
import { useFarmerAuth } from '@/context/FarmerAuthContext';
import { useLocale } from '@/context/LocaleContext';
import { whatsAppUrl } from '@/lib/config';

export default function ProfileTabScreen() {
  const router = useRouter();
  const { logout } = useFarmerAuth();
  const { locale, setLocale } = useLocale();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [whatsappAlerts, setWhatsappAlerts] = useState(true);

  useEffect(() => {
    void fetchPortalProfile()
      .then((p) => {
        setName([p.firstName, p.lastName].filter(Boolean).join(' '));
        setPhone(p.phone ?? '');
        setEmail(p.email ?? '');
      })
      .catch(() => {});
  }, []);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Panel title={name || t('profile', locale)}>
        <KeyValueRow label="Phone" value={phone || '—'} />
        <KeyValueRow label="Email" value={email || '—'} />
      </Panel>

      <Panel title="Menu">
        <Btn label={t('myBlocks', locale)} variant="secondary" onPress={() => router.push('/fields')} accessibilityLabel={t('myBlocks', locale)} />
        <Btn label="Account & address" variant="secondary" onPress={() => router.push('/address')} />
        <Btn label={t('orders', locale)} variant="secondary" onPress={() => router.push('/orders')} />
        <Btn label={t('notifications', locale)} variant="secondary" onPress={() => router.push('/intel/notifications')} />
        <Btn label={t('scanHistory', locale)} variant="secondary" onPress={() => router.push('/scan/history')} />
      </Panel>

      <Panel title="WhatsApp alerts">
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Order & advisory updates via WhatsApp</Text>
          <Switch
            value={whatsappAlerts}
            onValueChange={setWhatsappAlerts}
            trackColor={{ true: tokens.green500, false: tokens.border }}
            accessibilityLabel="WhatsApp notifications"
          />
        </View>
        <Text style={styles.hint}>Contact support to change delivery preferences on your account.</Text>
      </Panel>

      <Panel title={t('language', locale)}>
        <View style={styles.langRow}>
          {(['en', 'hi', 'ml'] as const).map((code) => (
            <Btn
              key={code}
              label={code === 'en' ? 'English' : code === 'hi' ? 'हिंदी' : 'മലയാളം'}
              variant={locale === code ? 'primary' : 'secondary'}
              onPress={() => setLocale(code)}
            />
          ))}
        </View>
      </Panel>

      <Btn label="Help & support" variant="secondary" onPress={() => Linking.openURL(whatsAppUrl('Farmer app help'))} />
      <WhatsAppBtn label="WhatsApp support" />
      <Btn label={t('logout', locale)} variant="secondary" onPress={() => void logout()} accessibilityLabel={t('logout', locale)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32, gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  switchLabel: { flex: 1, fontSize: 14, color: tokens.text },
  hint: { fontSize: 12, color: tokens.textMuted, marginTop: 8 },
  langRow: { gap: 8 },
});
