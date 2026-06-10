import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { tokens } from '@morbeez/shared';
import { AlertBox, Btn, MorbeezLogo, Screen, TextField } from '@morbeez/ui-native';
import { useStaffAuth } from '@/context/StaffAuth';

export default function LoginScreen() {
  const { login } = useStaffAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/(app)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <MorbeezLogo height={48} style={styles.logo} />
          <Text style={styles.title}>Telecaller CRM</Text>
          <Text style={styles.subtitle}>CRM workspace for leads, calls & follow-ups.</Text>
          {error ? <AlertBox>{error}</AlertBox> : null}
          <TextField label="Work email" value={email} onChangeText={setEmail} keyboardType="email-address" />
          <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry />
          <Btn label={loading ? 'Signing in…' : 'Sign in'} onPress={onSubmit} disabled={loading} />
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
});
