import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { farmerSignup, phoneForCheckout, t, tokens } from '@morbeez/shared';
import { AlertBox, Btn, KeyboardAwareScrollScreen, MorbeezLogo, PasswordField, Screen, TextField } from '@morbeez/ui-native';
import { useFarmerAuth } from '@/context/FarmerAuthContext';
import { useLocale } from '@/context/LocaleContext';

export default function SignupScreen() {
  const router = useRouter();
  const { refresh } = useFarmerAuth();
  const { locale } = useLocale();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError('');
    const normalizedPhone = phoneForCheckout(phone);
    if (normalizedPhone.length !== 10) {
      setError(t('phoneRequired', locale));
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError(t('passwordsMustMatch', locale));
      return;
    }
    setLoading(true);
    try {
      await farmerSignup({
        email: email.trim() || undefined,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: normalizedPhone,
        password,
        acceptTerms: true,
      });
      await refresh();
      router.replace('/(tabs)/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAwareScrollScreen contentContainerStyle={styles.scroll}>
          <MorbeezLogo height={44} style={styles.logo} />
          <Text style={styles.title}>{t('createAccount', locale)}</Text>
          {error ? <AlertBox>{error}</AlertBox> : null}
          <TextField label="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
          <TextField label="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
          <TextField
            label={`${t('mobile', locale)} *`}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <TextField
            label={t('emailOptional', locale)}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />
          <PasswordField label="Password (min 8 chars)" value={password} onChangeText={setPassword} />
          <PasswordField label={t('confirmPassword', locale)} value={confirmPassword} onChangeText={setConfirmPassword} />
          <Btn label={loading ? 'Creating…' : t('createAccount', locale)} onPress={() => void onSubmit()} disabled={loading} />
          <Btn label="Back to sign in" onPress={() => router.back()} variant="secondary" />
        </KeyboardAwareScrollScreen>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingTop: 48 },
  logo: { alignSelf: 'center', marginBottom: 20 },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: tokens.text,
    marginBottom: 20,
  },
});
