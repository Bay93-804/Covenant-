import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, Screen, TextField } from '../../src/design-system';
import { BrandHeader } from '../../src/features/auth/BrandHeader';
import { isSupabaseConfigured } from '../../src/lib/env';
import { supabase } from '../../src/lib/supabase/client';

/**
 * Reached only by tapping a password-reset link — see
 * src/lib/auth/authDeepLink.ts, which establishes a recovery session from
 * the link's tokens and routes here. There is no demo-mode equivalent
 * (demo mode's "reset" is a no-op with nothing to recover into — see
 * demoRequestPasswordReset), so this screen assumes a real Supabase
 * recovery session already exists.
 */
export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      setError('No recovery session is available.');
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update your password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll>
      <BrandHeader />
      <AppText variant="h2" color="primary" center style={{ marginBottom: 8 }}>
        Set a new password
      </AppText>

      {done ? (
        <View className="items-center gap-4">
          <AppText variant="body" color="primary" center>
            Your password has been updated. Sign in with your new password.
          </AppText>
          <Button onPress={() => router.replace('/(auth)/sign-in')}>Back to Sign In</Button>
        </View>
      ) : (
        <>
          <TextField
            label="New password"
            required
            secureTextEntry
            autoComplete="password-new"
            value={password}
            onChangeText={setPassword}
          />
          <TextField
            label="Confirm new password"
            required
            secureTextEntry
            autoComplete="password-new"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          {error ? (
            <AppText variant="bodySm" color="danger" style={{ marginBottom: 12 }}>
              {error}
            </AppText>
          ) : null}
          <Button onPress={handleSubmit} loading={loading}>
            Update Password
          </Button>
        </>
      )}
    </Screen>
  );
}
