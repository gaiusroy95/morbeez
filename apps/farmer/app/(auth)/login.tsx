import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { farmerLogin, tokens } from '@morbeez/shared';
import { AlertBox, Btn, Screen, TextField } from '@morbeez/ui-native';
import { useFarmerAuth } from '@/context/FarmerAuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { refresh } = useFarmerAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
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

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>Morbeez</Text>
          <Text style={styles.title}>Farmer sign in</Text>
          <Text style={styles.subtitle}>Track orders, advisory, soil reports & shop inputs.</Text>
          {error ? <AlertBox>{error}</AlertBox> : null}
          <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
          <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry />
          <Btn label={loading ? 'Signing in…' : 'Sign in'} onPress={onSubmit} disabled={loading} />
          <Link href="/(auth)/signup" style={styles.link}>
            <Text style={styles.linkText}>Create account</Text>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  brand: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.green700,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: tokens.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: tokens.textMuted,
    marginBottom: 24,
  },
  link: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    color: tokens.green700,
    fontSize: 15,
    fontWeight: '600',
  },
});
