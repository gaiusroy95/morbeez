import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { phoneForCheckout, sendPartnerOtp, tokens } from '@morbeez/shared';
import { AlertBox, Btn, KeyboardAwareScrollScreen, MorbeezLogo, Screen, TextField } from '@morbeez/ui-native';
import { usePartnerAuth } from '@/context/PartnerAuth';

export default function LoginScreen() {
  const { loginWithOtp } = usePartnerAuth();
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtpHint, setDevOtpHint] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSendOtp() {
    setError('');
    setDevOtpHint('');
    setLoading(true);
    try {
      const phone = phoneForCheckout(mobile);
      if (phone.length !== 10) throw new Error('Enter a valid 10-digit mobile number');
      const result = await sendPartnerOtp(phone);
      if (result.devOtp) setDevOtpHint(`Dev OTP: ${result.devOtp}`);
      setStep('code');
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
        {step === 'phone' ? (
          <>
            <TextField label="Mobile" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" />
            <Btn label="Send OTP" onPress={onSendOtp} disabled={loading} />
          </>
        ) : (
          <>
            <TextField label="OTP" value={otp} onChangeText={setOtp} keyboardType="number-pad" />
            <Btn label="Verify & sign in" onPress={onVerifyOtp} disabled={loading} />
            <Btn label="Change number" onPress={() => setStep('phone')} variant="secondary" disabled={loading} />
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
});
