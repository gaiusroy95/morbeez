import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { farmerLogin, phoneForCheckout, sendOtp, t, verifyOtp } from '@morbeez/shared';
import { AlertBox, Btn, KeyboardAwareScrollScreen, LanguagePicker, MorbeezLogo, PasswordField, Screen, TextField } from '@morbeez/ui-native';
import { useFarmerAuth } from '@/context/FarmerAuthContext';
import { useLocale } from '@/context/LocaleContext';

export default function LoginScreen() {
  const router = useRouter();
  const { refresh } = useFarmerAuth();
  const { locale, setLocale } = useLocale();
  const [mode, setMode] = useState<'otp' | 'email'>('otp');
  const [otpStep, setOtpStep] = useState<'phone' | 'code'>('phone');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [devOtpHint, setDevOtpHint] = useState('');
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

  async function onSendOtp() {
    setError('');
    setDevOtpHint('');
    setLoading(true);
    try {
      const phone = phoneForCheckout(mobile);
      if (phone.length !== 10) throw new Error('Enter a valid 10-digit mobile number');
      const result = await sendOtp(phone);
      if (result.devOtp) setDevOtpHint(`Dev OTP: ${result.devOtp}`);
      setOtpStep('code');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send OTP');
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyOtp() {
    setError('');
    setLoading(true);
    try {
      const phone = phoneForCheckout(mobile);
      await verifyOtp(phone, otp.trim());
      await refresh();
      router.replace('/(tabs)/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAwareScrollScreen centered contentContainerStyle={styles.scroll}>
          <MorbeezLogo height={48} style={styles.logo} />
          <Text style={styles.title}>Morbeez Farmer</Text>
          <Text style={styles.subtitle}>{t('appTagline', locale)}</Text>

          <Text style={styles.label}>{t('language', locale)}</Text>
          <LanguagePicker locale={locale} onChange={setLocale} />

          {error ? <AlertBox>{error}</AlertBox> : null}
          {devOtpHint ? <AlertBox>{devOtpHint}</AlertBox> : null}

          {mode === 'otp' ? (
            <>
              {otpStep === 'phone' ? (
                <>
                  <TextField
                    label={t('mobile', locale)}
                    value={mobile}
                    onChangeText={setMobile}
                    keyboardType="phone-pad"
                    accessibilityLabel={t('mobile', locale)}
                  />
                  <Btn
                    label={loading ? t('loading', locale) : t('otpSend', locale)}
                    onPress={() => void onSendOtp()}
                    disabled={loading || mobile.replace(/\D/g, '').length < 10}
                  />
                </>
              ) : (
                <>
                  <TextField
                    label={t('otpCode', locale)}
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                    accessibilityLabel={t('otpCode', locale)}
                  />
                  <Btn
                    label={loading ? t('loading', locale) : t('otpVerify', locale)}
                    onPress={() => void onVerifyOtp()}
                    disabled={loading || otp.length < 6}
                  />
                  <Pressable onPress={() => setOtpStep('phone')} style={styles.linkWrap}>
                    <Text style={styles.linkText}>{t('changeMobile', locale)}</Text>
                  </Pressable>
                </>
              )}
              <Pressable onPress={() => setMode('email')} style={styles.linkWrap}>
                <Text style={styles.linkText}>{t('useEmail', locale)}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" accessibilityLabel="Email" />
              <PasswordField label="Password" value={password} onChangeText={setPassword} accessibilityLabel="Password" />
              <Btn label={loading ? t('loading', locale) : t('login', locale)} onPress={() => void onEmailSubmit()} disabled={loading} />
              <Pressable onPress={() => setMode('otp')} style={styles.linkWrap}>
                <Text style={styles.linkText}>{t('useOtp', locale)}</Text>
              </Pressable>
            </>
          )}

          <Link href="/(auth)/signup" style={styles.linkWrap}>
            <Text style={styles.linkText}>{t('createAccount', locale)}</Text>
          </Link>
        </KeyboardAwareScrollScreen>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingTop: 0 },
  logo: { alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#1a1a1a', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#666', marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: '#1a1a1a', marginBottom: 8 },
  linkWrap: { marginTop: 16, alignItems: 'center' },
  linkText: { color: '#2d6a4f', fontSize: 15, fontWeight: '600' },
});
