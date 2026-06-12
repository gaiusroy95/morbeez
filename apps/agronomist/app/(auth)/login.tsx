import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { phoneForCheckout, sendStaffOtp, t, tokens } from '@morbeez/shared';
import { AlertBox, Btn, KeyboardAwareScrollScreen, LanguagePicker, MorbeezLogo, PasswordField, Screen, TextField } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';
import { useStaffAuth } from '@/context/StaffAuth';

export default function LoginScreen() {
  const { login, loginWithOtp } = useStaffAuth();
  const router = useRouter();
  const { locale, setLocale } = useLocale();
  const [mode, setMode] = useState<'otp' | 'email'>('otp');
  const [otpStep, setOtpStep] = useState<'phone' | 'code'>('phone');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtpHint, setDevOtpHint] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onEmailSubmit() {
    setError('');
    setLoading(true);
    try {
      if (!email.trim()) throw new Error(t('workEmail', locale));
      if (!password) throw new Error(t('password', locale));
      await login(email.trim(), password);
      router.replace('/(tabs)/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('login', locale));
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
      if (phone.length !== 10) throw new Error(t('phoneRequired', locale));
      const result = await sendStaffOtp(phone);
      if (result.devOtp) setDevOtpHint(`Dev OTP: ${result.devOtp}`);
      setOtpStep('code');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('otpSend', locale));
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyOtp() {
    setError('');
    setLoading(true);
    try {
      const phone = phoneForCheckout(mobile);
      await loginWithOtp(phone, otp.trim());
      router.replace('/(tabs)/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('otpCode', locale));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAwareScrollScreen centered contentContainerStyle={styles.scroll}>
          <MorbeezLogo height={48} style={styles.logo} />
          <Text style={styles.title}>{t('morbeezAgronomist', locale)}</Text>
          <Text style={styles.subtitle}>{t('agronomistTagline', locale)}</Text>

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
                    label={loading ? t('loading', locale) : t('verifySignIn', locale)}
                    onPress={() => void onVerifyOtp()}
                    disabled={loading || otp.length < 6}
                  />
                  <Pressable onPress={() => setOtpStep('phone')} style={styles.linkWrap}>
                    <Text style={styles.linkText}>{t('changeMobile', locale)}</Text>
                  </Pressable>
                </>
              )}
              <Pressable onPress={() => setMode('email')} style={styles.linkWrap}>
                <Text style={styles.linkText}>{t('useEmailInstead', locale)}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <TextField
                label={t('workEmail', locale)}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                accessibilityLabel={t('workEmail', locale)}
              />
              <PasswordField
                label={t('password', locale)}
                value={password}
                onChangeText={setPassword}
                accessibilityLabel={t('password', locale)}
              />
              <Btn
                label={loading ? t('loading', locale) : t('login', locale)}
                onPress={() => void onEmailSubmit()}
                disabled={loading || !email.trim() || !password}
              />
              <Pressable onPress={() => setMode('otp')} style={styles.linkWrap}>
                <Text style={styles.linkText}>{t('useMobileOtp', locale)}</Text>
              </Pressable>
            </>
          )}
        </KeyboardAwareScrollScreen>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingTop: 0 },
  logo: { alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '700', color: tokens.green800, marginBottom: 8 },
  subtitle: { fontSize: 15, color: tokens.textMuted, marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: tokens.text, marginBottom: 8 },
  linkWrap: { marginTop: 16, alignItems: 'center' },
  linkText: { color: tokens.green700, fontSize: 15, fontWeight: '600' },
});
