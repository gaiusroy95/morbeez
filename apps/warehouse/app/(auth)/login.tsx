import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { phoneForCheckout, sendStaffOtp, tokens } from '@morbeez/shared';
import { AlertBox, Btn, MorbeezLogo, PasswordField, Screen, TextField } from '@morbeez/ui-native';
import { useStaffAuth } from '@/context/StaffAuth';

export default function LoginScreen() {
  const { login, loginWithOtp } = useStaffAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'otp' | 'password'>('otp');
  const [otpStep, setOtpStep] = useState<'phone' | 'code'>('phone');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtpHint, setDevOtpHint] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onPasswordSubmit() {
    setError('');
    setLoading(true);
    try {
      const phone = phoneForCheckout(mobile);
      if (phone.length !== 10) throw new Error('Enter a valid 10-digit mobile number');
      await login(phone, password, email.trim() || undefined);
      router.replace('/(app)');
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
      const result = await sendStaffOtp(phone);
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
      router.replace('/(app)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <MorbeezLogo height={48} style={styles.logo} />
          <Text style={styles.title}>Pick & Pack</Text>
          <Text style={styles.subtitle}>Warehouse fulfillment — pick, pack & dispatch.</Text>
          {error ? <AlertBox>{error}</AlertBox> : null}
          {devOtpHint ? <AlertBox>{devOtpHint}</AlertBox> : null}

          {mode === 'otp' ? (
            <>
              {otpStep === 'phone' ? (
                <>
                  <TextField
                    label="Mobile number *"
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
                    label="Enter OTP"
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                    accessibilityLabel="Enter OTP"
                  />
                  <Btn
                    label={loading ? 'Verifying…' : 'Verify & sign in'}
                    onPress={() => void onVerifyOtp()}
                    disabled={loading || otp.length < 6}
                  />
                  <Pressable onPress={() => setOtpStep('phone')} style={styles.linkWrap}>
                    <Text style={styles.linkText}>Change mobile number</Text>
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
                label="Mobile number *"
                value={mobile}
                onChangeText={setMobile}
                keyboardType="phone-pad"
                accessibilityLabel="Mobile number"
              />
              <TextField
                label="Work email (optional)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                accessibilityLabel="Work email optional"
              />
              <PasswordField label="Password" value={password} onChangeText={setPassword} />
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
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  logo: { alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '700', color: tokens.green800, marginBottom: 8 },
  subtitle: { fontSize: 15, color: tokens.textMuted, marginBottom: 24 },
  linkWrap: { marginTop: 16, alignItems: 'center' },
  linkText: { color: tokens.green700, fontSize: 15, fontWeight: '600' },
});
