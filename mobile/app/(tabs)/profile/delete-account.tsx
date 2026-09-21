import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, Card, Screen, TextField } from '../../../src/design-system';
import {
  deleteAccount,
  AccountDeletionError,
} from '../../../src/lib/accountDeletion/deleteAccount';
import { useAuth } from '../../../src/lib/auth/AuthContext';

const CONFIRM_PHRASE = 'DELETE';

/**
 * Production-review-ready account deletion: explains exactly what's
 * deleted, requires re-entering the password (reauthentication) and typing
 * a confirmation phrase (accidental-deletion guard) before the destructive
 * action is enabled at all. See src/lib/accountDeletion/deleteAccount.ts
 * for what actually happens in each mode.
 */
export default function DeleteAccountScreen() {
  const { user, isDemoMode, signIn, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = password.length > 0 && confirmText.trim().toUpperCase() === CONFIRM_PHRASE;

  async function handleDelete() {
    if (!user?.email) {
      setError('No signed-in account found.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      // Reauthentication: prove the password is still correct right now,
      // immediately before the destructive call — a stale, still-valid
      // session token alone is not treated as sufficient for this action.
      await signIn(user.email, password);
      await deleteAccount(user.id);
      await signOut().catch(() => {});
      router.replace('/(auth)/sign-in');
    } catch (e) {
      if (e instanceof AccountDeletionError) {
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : 'Incorrect password, or deletion failed.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll>
      <AppText variant="h2" color="danger" style={{ marginTop: 16, marginBottom: 16 }}>
        Delete your account
      </AppText>

      <Card className="mb-4" emphasized>
        <AppText variant="body" color="primary" style={{ marginBottom: 8 }}>
          This permanently deletes:
        </AppText>
        <AppText variant="bodySm" color="secondary" style={{ marginBottom: 4 }}>
          • Your profile, program enrollment, and notification preferences
        </AppText>
        <AppText variant="bodySm" color="secondary" style={{ marginBottom: 4 }}>
          • Every logged workout, set, and readiness/safety-adjustment entry
        </AppText>
        <AppText variant="bodySm" color="secondary" style={{ marginBottom: 4 }}>
          • Every Week 0/6/12 testing result and RHR morning reading
        </AppText>
        <AppText variant="bodySm" color="secondary" style={{ marginBottom: 4 }}>
          • Your exercise maxes, personal records, and pickup-sport journal entries
        </AppText>
        <AppText variant="bodySm" color="secondary" style={{ marginBottom: 8 }}>
          • All of the above as stored locally on this device
          {isDemoMode ? '' : ', and in the cloud'}
        </AppText>
        <AppText variant="bodySm" color="danger">
          This cannot be undone.
        </AppText>
      </Card>

      {isDemoMode ? (
        <Card className="mb-4">
          <AppText variant="bodySm" color="secondary">
            Demo mode: this deletes the local demo account only — there is no cloud record to
            remove.
          </AppText>
        </Card>
      ) : null}

      <TextField
        label="Confirm your password"
        required
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
      />

      <TextField
        label={`Type ${CONFIRM_PHRASE} to confirm`}
        required
        autoCapitalize="characters"
        value={confirmText}
        onChangeText={setConfirmText}
      />

      {error ? (
        <AppText variant="bodySm" color="danger" style={{ marginBottom: 12 }}>
          {error}
        </AppText>
      ) : null}

      <View className="gap-3">
        <Button variant="danger" onPress={handleDelete} loading={loading} disabled={!canSubmit}>
          Permanently Delete Account
        </Button>
        <Button variant="secondary" onPress={() => router.back()}>
          Cancel
        </Button>
      </View>
    </Screen>
  );
}
