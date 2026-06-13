import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { phoneForCheckout, sendPartnerOtp, tokens } from '@morbeez/shared';
import {
  AlertBox,
  Btn,
  KeyboardAwareScrollScreen,
  MorbeezLogo,
  PasswordField,
  Screen,
  TextField,
} from '@morbeez/ui-native';
import { usePartnerAuth } from '@/context/PartnerAuth';

export default function LoginScreen() {
  const { loginWithOtp, loginWithPassword } = usePartnerAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'otp' | 'password'>('otp');
  const [otpStep, setOtpStep] = useState<'phone' | 'code'>('phone');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [devOtpHint, setDevOtpHint] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onPasswordSubmit() {
    setError('');
    setLoading(true);
    try {
      const phone = phoneForCheckout(mobile);
      if (phone.length !== 10) throw new Error('Enter a valid 10-digit mobile number');
      if (!password) throw new Error('Enter your password');
      await loginWithPassword(phone, password);
      router.replace('/(tabs)/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed');
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
      const result = await sendPartnerOtp(phone);
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
      await loginWithOtp(phone, otp.trim());
      router.replace('/(tabs)/dashboard');
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
        <Text style={styles.title}>Morbeez Partner</Text>
        <Text style={styles.subtitle}>Field visits, farmer success, local growth</Text>

        {error ? <AlertBox>{error}</AlertBox> : null}
        {devOtpHint ? <AlertBox>{devOtpHint}</AlertBox> : null}

        {mode === 'otp' ? (
          <>
            {otpStep === 'phone' ? (
              <>
                <TextField
                  label="Mobile"
                  value={mobile}
                  onChangeText={setMobile}
                  keyboardType="phone-pad"
                  accessibilityLabel="Mobile number"
                />
                <Btn
                  label={loading ? 'Sending…' : 'Send OTP'}
                  onPress={() => void onSendOtp()}
                  disabled={loading || mobile.replace(/\D/g, '').length < 10}
                />
              </>
            ) : (
              <>
                <TextField
                  label="OTP"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                  accessibilityLabel="One-time password"
                />
                <Btn
                  label={loading ? 'Verifying…' : 'Verify & sign in'}
                  onPress={() => void onVerifyOtp()}
                  disabled={loading || otp.length < 6}
                />
                <Pressable onPress={() => setOtpStep('phone')} style={styles.linkWrap}>
                  <Text style={styles.linkText}>Change number</Text>
                </Pressable>
              </>
            )}
            <Pressable onPress={() => setMode('password')} style={styles.linkWrap}>
              <Text style={styles.linkText}>Use password instead</Text>
            </Pressable>
          </>
        ) : (
          <>
            <TextField
              label="Mobile"
              value={mobile}
              onChangeText={setMobile}
              keyboardType="phone-pad"
              accessibilityLabel="Mobile number"
            />
            <PasswordField
              label="Password"
              value={password}
              onChangeText={setPassword}
              accessibilityLabel="Password"
            />
            <Btn
              label={loading ? 'Signing in…' : 'Sign in'}
              onPress={() => void onPasswordSubmit()}
              disabled={loading || mobile.replace(/\D/g, '').length < 10 || !password}
            />
            <Pressable onPress={() => setMode('otp')} style={styles.linkWrap}>
              <Text style={styles.linkText}>Use mobile OTP instead</Text>
            </Pressable>
          </>
        )}
      </KeyboardAwareScrollScreen>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24 },
  logo: { alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: tokens.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: tokens.textMuted, textAlign: 'center', marginBottom: 20 },
  linkWrap: { marginTop: 16, alignItems: 'center' },
  linkText: { color: tokens.green700, fontSize: 15, fontWeight: '600' },
});
