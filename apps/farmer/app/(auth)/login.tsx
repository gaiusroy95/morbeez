import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { farmerLogin, t, tokens } from '@morbeez/shared';
import { AlertBox, Btn, HubTabs, MorbeezLogo, Screen, TextField } from '@morbeez/ui-native';
import { useFarmerAuth } from '@/context/FarmerAuthContext';
import { useLocale } from '@/context/LocaleContext';

export default function LoginScreen() {
  const router = useRouter();
  const { refresh } = useFarmerAuth();
  const { locale, setLocale } = useLocale();
  const [mode, setMode] = useState<'otp' | 'email'>('otp');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onEmailSubmit() {
    setError('');
    setLoading(true);
    try {
      await farmerLogin(email.trim(), password);
      await refresh();
      router.replace('/(tabs)/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  function onOtpSubmit() {
    setError('Mobile OTP login is coming soon. Use email sign-in below.');
    setMode('email');
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <MorbeezLogo height={48} style={styles.logo} />
          <Text style={styles.title}>Morbeez Farmer</Text>
          <Text style={styles.subtitle}>{t('appTagline', locale)}</Text>

          <Text style={styles.label}>{t('language', locale)}</Text>
          <HubTabs
            tabs={[
              { id: 'en' as const, label: 'English' },
              { id: 'hi' as const, label: 'हिंदी' },
            ]}
            active={locale}
            onChange={setLocale}
          />

          {error ? <AlertBox>{error}</AlertBox> : null}

          {mode === 'otp' ? (
            <>
              <TextField label={t('mobile', locale)} value={mobile} onChangeText={setMobile} keyboardType="phone-pad" />
              <Btn label={t('otpSend', locale)} onPress={onOtpSubmit} disabled={loading || mobile.length < 10} />
              <Pressable onPress={() => setMode('email')} style={styles.linkWrap}>
                <Text style={styles.linkText}>{t('useEmail', locale)}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
              <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry />
              <Btn label={loading ? 'Signing in…' : t('login', locale)} onPress={() => void onEmailSubmit()} disabled={loading} />
              <Pressable onPress={() => setMode('otp')} style={styles.linkWrap}>
                <Text style={styles.linkText}>Use mobile OTP</Text>
              </Pressable>
            </>
          )}

          <Link href="/(auth)/signup" style={styles.linkWrap}>
            <Text style={styles.linkText}>Create account</Text>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  logo: { alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '700', color: tokens.text, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 15, color: tokens.textMuted, marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: tokens.text, marginBottom: 8 },
  linkWrap: { marginTop: 16, alignItems: 'center' },
  linkText: { color: tokens.green700, fontSize: 15, fontWeight: '600' },
});
