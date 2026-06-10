import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchPortalProfile, t, tokens } from '@morbeez/shared';
import { Btn, HubTabs, KeyValueRow, Panel } from '@morbeez/ui-native';
import { WhatsAppBtn } from '@/components/PortalHelpers';
import { useFarmerAuth } from '@/context/FarmerAuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useEffect, useState } from 'react';

export default function ProfileTabScreen() {
  const router = useRouter();
  const { logout } = useFarmerAuth();
  const { locale, setLocale } = useLocale();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

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
      <Panel title="Personal details">
        <KeyValueRow label="Name" value={name || '—'} />
        <KeyValueRow label="Phone" value={phone || '—'} />
        <KeyValueRow label="Email" value={email || '—'} />
        <Btn label="Edit delivery address" variant="secondary" onPress={() => router.push('/address')} />
      </Panel>

      <Panel title={t('language', locale)}>
        <HubTabs
          tabs={[
            { id: 'en' as const, label: 'English' },
            { id: 'hi' as const, label: 'हिंदी' },
          ]}
          active={locale}
          onChange={setLocale}
        />
      </Panel>

      <Panel title="Account">
        <Btn label={t('orders', locale)} variant="secondary" onPress={() => router.push('/orders')} />
        <Btn label="Soil reports" variant="secondary" onPress={() => router.push('/reports')} />
        <Btn label={t('notifications', locale)} variant="secondary" onPress={() => router.push('/intel/notifications')} />
        <Btn label={t('weatherMarket', locale)} variant="secondary" onPress={() => router.push('/intel/weather-market')} />
        <Btn label={t('roi', locale)} variant="secondary" onPress={() => router.push('/intel/roi')} />
      </Panel>

      <WhatsAppBtn label="WhatsApp support" />
      <Btn label={t('logout', locale)} variant="secondary" onPress={() => void logout()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32, gap: 8 },
});
