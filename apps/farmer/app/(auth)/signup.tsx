import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { farmerSignup, tokens } from '@morbeez/shared';
import { AlertBox, Btn, Screen, TextField } from '@morbeez/ui-native';
import { useFarmerAuth } from '@/context/FarmerAuthContext';

export default function SignupScreen() {
  const router = useRouter();
  const { refresh } = useFarmerAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError('');
    setLoading(true);
    try {
      await farmerSignup({
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Create farmer account</Text>
          {error ? <AlertBox>{error}</AlertBox> : null}
          <TextField label="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
          <TextField label="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
          <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
          <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <TextField label="Password (min 8 chars)" value={password} onChangeText={setPassword} secureTextEntry />
          <Btn label={loading ? 'Creating…' : 'Create account'} onPress={onSubmit} disabled={loading} />
          <Btn label="Back to sign in" onPress={() => router.back()} variant="secondary" />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingTop: 48 },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: tokens.text,
    marginBottom: 20,
  },
});
