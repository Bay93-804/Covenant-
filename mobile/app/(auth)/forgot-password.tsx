import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, Screen, TextField } from '../../src/design-system';
import { BrandHeader } from '../../src/features/auth/BrandHeader';
import { useAuth } from '../../src/lib/auth/AuthContext';

export default function ForgotPasswordScreen() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!email.trim()) {
      setError('Enter your email.');
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send a reset link.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll>
      <BrandHeader />
      <AppText variant="h2" color="primary" center style={{ marginBottom: 8 }}>
        Reset your password
      </AppText>
      <AppText variant="body" color="secondary" center style={{ marginBottom: 24 }}>
        Enter the email on your account and we&apos;ll send you a reset link.
      </AppText>

      {sent ? (
        <View className="items-center gap-4">
          <AppText variant="body" color="primary" center>
            If an account exists for {email}, a reset link is on its way.
          </AppText>
          <Button variant="secondary" onPress={() => router.replace('/(auth)/sign-in')}>
            Back to Sign In
          </Button>
        </View>
      ) : (
        <>
          <TextField
            label="Email"
            required
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />
          {error ? (
            <AppText variant="bodySm" color="danger" style={{ marginBottom: 12 }}>
              {error}
            </AppText>
          ) : null}
          <Button onPress={handleSubmit} loading={loading}>
            Send Reset Link
          </Button>
        </>
      )}
    </Screen>
  );
}
