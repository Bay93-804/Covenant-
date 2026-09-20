import { Link, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, Screen, TextField } from '../../src/design-system';
import { BrandHeader } from '../../src/features/auth/BrandHeader';
import { useAuth } from '../../src/lib/auth/AuthContext';

export default function SignInScreen() {
  const { signIn, isDemoMode } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll>
      <BrandHeader tagline="Still an athlete at 33 — and still one at 63" />

      {isDemoMode ? (
        <View className="mb-6 rounded-md border border-gold-600 bg-navy-800 p-3">
          <AppText variant="bodySm" color="accent" center>
            Demo mode — no Supabase connection configured. Sign-in is local to this device.
          </AppText>
        </View>
      ) : null}

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
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
      />

      {error ? (
        <AppText variant="bodySm" color="danger" style={{ marginBottom: 12 }}>
          {error}
        </AppText>
      ) : null}

      <Button onPress={handleSignIn} loading={loading}>
        Sign In
      </Button>

      <View className="mt-4 items-center">
        <Link href="/(auth)/forgot-password">
          <AppText variant="bodySm" color="secondary">
            Forgot password?
          </AppText>
        </Link>
      </View>

      <View className="mt-8 flex-row justify-center gap-1">
        <AppText variant="body" color="secondary">
          New here?
        </AppText>
        <Link href="/(auth)/sign-up">
          <AppText variant="body" color="accent" weight="600">
            Create an account
          </AppText>
        </Link>
      </View>
    </Screen>
  );
}
