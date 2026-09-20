import { Link, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, Screen, TextField } from '../../src/design-system';
import { BrandHeader } from '../../src/features/auth/BrandHeader';
import { useAuth } from '../../src/lib/auth/AuthContext';

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password);
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create your account.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll>
      <BrandHeader tagline="Absorb · Build · Express" />

      <TextField
        label="Email"
        required
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
      />
      <TextField
        label="Password"
        required
        secureTextEntry
        autoComplete="password-new"
        hint="At least 8 characters."
        value={password}
        onChangeText={setPassword}
      />
      <TextField
        label="Confirm password"
        required
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      {error ? (
        <AppText variant="bodySm" color="danger" style={{ marginBottom: 12 }}>
          {error}
        </AppText>
      ) : null}

      <Button onPress={handleSignUp} loading={loading}>
        Create Account
      </Button>

      <View className="mt-8 flex-row justify-center gap-1">
        <AppText variant="body" color="secondary">
          Already training with us?
        </AppText>
        <Link href="/(auth)/sign-in">
          <AppText variant="body" color="accent" weight="600">
            Sign in
          </AppText>
        </Link>
      </View>
    </Screen>
  );
}
