import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  fetchPortalProfile,
  isAppLocale,
  t,
  tokens,
} from '@morbeez/shared';
import { Btn, KeyValueRow, LanguagePicker, Panel } from '@morbeez/ui-native';
import { WhatsAppBtn } from '@/components/PortalHelpers';
import { useFarmerAuth } from '@/context/FarmerAuthContext';
import { useLocale } from '@/context/LocaleContext';
import { whatsAppUrl } from '@/lib/config';

export default function ProfileTabScreen() {
  const router = useRouter();
  const { logout, farmer } = useFarmerAuth();
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
        const lang = p.preferredLanguage?.slice(0, 2);
        if (lang && isAppLocale(lang)) setLocale(lang);
      })
      .catch(() => {});
  }, [setLocale]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Panel title={name || t('profile', locale)}>
        <KeyValueRow label={t('phone', locale)} value={phone || '—'} />
        <KeyValueRow label={t('email', locale)} value={email || '—'} />
      </Panel>

      <Panel title={t('menu', locale)}>
        <Btn label={t('myBlocks', locale)} variant="secondary" onPress={() => router.push('/fields')} />
        <Btn label={t('accountAddress', locale)} variant="secondary" onPress={() => router.push('/address')} />
        <Btn
          label={farmer?.hasPassword ? t('changePassword', locale) : t('setPassword', locale)}
          variant="secondary"
          onPress={() => router.push('/change-password')}
        />
        <Btn label={t('orders', locale)} variant="secondary" onPress={() => router.push('/orders')} />
        <Btn label={t('notifications', locale)} variant="secondary" onPress={() => router.push('/intel/notifications')} />
        <Btn label={t('scanHistory', locale)} variant="secondary" onPress={() => router.push('/scan/history')} />
      </Panel>

      <Panel title={t('whatsappAlerts', locale)}>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('whatsappOrderUpdates', locale)}</Text>
          <Switch
            value={whatsappAlerts}
            onValueChange={setWhatsappAlerts}
            trackColor={{ true: tokens.green500, false: tokens.border }}
            accessibilityLabel={t('whatsappAlerts', locale)}
          />
        </View>
        <Text style={styles.hint}>{t('whatsappAlertHint', locale)}</Text>
      </Panel>

      <Panel title={t('language', locale)}>
        <Text style={styles.hint}>{t('languageHint', locale)}</Text>
        <LanguagePicker locale={locale} onChange={setLocale} />
      </Panel>

      <Btn label={t('helpSupport', locale)} variant="secondary" onPress={() => Linking.openURL(whatsAppUrl('Farmer app help'))} />
      <WhatsAppBtn label={t('whatsappSupport', locale)} />
      <Btn label={t('logout', locale)} variant="secondary" onPress={() => void logout()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32, gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  switchLabel: { flex: 1, fontSize: 14, color: tokens.text },
  hint: { fontSize: 13, color: tokens.textMuted, marginBottom: 10 },
});
