import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchPortalProfile, t, tokens, updatePortalAddress } from '@morbeez/shared';
import { AlertBox, Btn, Loading, TextField } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';

export default function AddressScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [city, setCity] = useState('');
  const [state, setStateVal] = useState('');
  const [pincode, setPincode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const p = await fetchPortalProfile();
        setAddress1(p.shippingAddress ?? '');
        setCity(p.city ?? '');
        setStateVal(p.state ?? '');
        setPincode(p.deliveryPincode ?? '');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load profile');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    setError('');
    try {
      await updatePortalAddress({
        address1: address1.trim(),
        address2: address2.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        pincode: pincode.trim() || undefined,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading label={t('loadingAddress', locale)} />;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <TextField label={t('addressLine1', locale)} value={address1} onChangeText={setAddress1} autoCapitalize="words" />
      <TextField label={t('addressLine2', locale)} value={address2} onChangeText={setAddress2} autoCapitalize="words" />
      <TextField label={t('city', locale)} value={city} onChangeText={setCity} autoCapitalize="words" />
      <TextField label={t('state', locale)} value={state} onChangeText={setStateVal} autoCapitalize="words" />
      <TextField label={t('pincode', locale)} value={pincode} onChangeText={setPincode} keyboardType="numeric" />
      <Btn label={saving ? t('loading', locale) : t('saveAddress', locale)} onPress={save} disabled={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16 },
});
