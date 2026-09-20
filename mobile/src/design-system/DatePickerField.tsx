import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';

import { Button } from './Button';
import { AppText } from './Text';
import { TextField } from './TextField';
import { semanticColor } from './tokens';

export interface DatePickerFieldProps {
  label: string;
  /** ISO `YYYY-MM-DD`, or `''` for no selection. */
  value: string;
  onChange: (isoDate: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  error?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
}

function parseIsoDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatForDisplay(iso: string): string {
  const date = parseIsoDate(iso);
  if (!date) return '';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Accessible date field. Uses the native OS date picker on iOS/Android
 * (`@react-native-community/datetimepicker`) — a modal sheet with
 * Cancel/Done on iOS, the native dialog on Android.
 *
 * `@react-native-community/datetimepicker` has no web implementation (its
 * platform-less fallback module renders `null` and warns — see its
 * `datetimepicker.js`), so on web this falls back to a plain validated text
 * field. The app's real targets are Expo Go on iOS/Android (per the PRD);
 * web is only used here as a bundling smoke test (`npm run export:web`).
 */
export function DatePickerField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  error,
  hint,
  required,
  placeholder = 'Select a date',
}: DatePickerFieldProps) {
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState<Date>(() => parseIsoDate(value) ?? minimumDate ?? new Date());

  if (Platform.OS === 'web') {
    return (
      <TextField
        label={label}
        required={required}
        value={value}
        onChangeText={onChange}
        error={error}
        hint={hint ?? 'YYYY-MM-DD (native date picker is used on iOS/Android).'}
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
      />
    );
  }

  function openPicker() {
    setDraft(parseIsoDate(value) ?? minimumDate ?? new Date());
    setVisible(true);
  }

  function handleAndroidChange(event: DateTimePickerEvent, selected?: Date) {
    setVisible(false);
    if (event.type === 'set' && selected) {
      onChange(toIsoDate(selected));
    }
  }

  function handleIOSDraftChange(_event: DateTimePickerEvent, selected?: Date) {
    if (selected) setDraft(selected);
  }

  function confirmIOS() {
    onChange(toIsoDate(draft));
    setVisible(false);
  }

  return (
    <View className="mb-4">
      <AppText variant="caption" color="secondary" style={{ marginBottom: 6 }}>
        {label}
        {required ? ' *' : ''}
      </AppText>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="Opens a date picker"
          accessibilityValue={value ? { text: formatForDisplay(value) } : undefined}
          onPress={openPicker}
          style={{
            flex: 1,
            minHeight: 48,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: error ? semanticColor.danger : semanticColor.borderSubtle,
            backgroundColor: semanticColor.backgroundElevated,
            paddingHorizontal: 14,
            justifyContent: 'center',
          }}
        >
          <AppText variant="body" color={value ? 'primary' : 'muted'}>
            {value ? formatForDisplay(value) : placeholder}
          </AppText>
        </Pressable>
        {!required && value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label}`}
            onPress={() => onChange('')}
            style={{
              minWidth: 48,
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: semanticColor.borderSubtle,
            }}
          >
            <AppText variant="body" color="secondary">
              ✕
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <AppText variant="bodySm" color="danger" style={{ marginTop: 4 }}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="bodySm" color="muted" style={{ marginTop: 4 }}>
          {hint}
        </AppText>
      ) : null}

      {visible && Platform.OS === 'android' ? (
        <DateTimePicker
          value={draft}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handleAndroidChange}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal
          visible={visible}
          transparent
          animationType="slide"
          onRequestClose={() => setVisible(false)}
        >
          <View
            style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(6,10,18,0.6)' }}
          >
            <View
              style={{
                backgroundColor: semanticColor.backgroundElevated,
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                padding: 16,
              }}
            >
              <DateTimePicker
                value={draft}
                mode="date"
                display="spinner"
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onChange={handleIOSDraftChange}
                themeVariant="dark"
                textColor={semanticColor.textPrimary}
              />
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Button variant="ghost" onPress={() => setVisible(false)}>
                    Cancel
                  </Button>
                </View>
                <View style={{ flex: 1 }}>
                  <Button onPress={confirmIOS}>Done</Button>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
