import { forwardRef } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { semanticColor } from './tokens';
import { AppText } from './Text';

export interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, required, style, ...rest },
  ref,
) {
  return (
    <View className="mb-4">
      <AppText variant="caption" color="secondary" style={{ marginBottom: 6 }}>
        {label}
        {required ? ' *' : ''}
      </AppText>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={semanticColor.textMuted}
        style={[
          {
            minHeight: 48,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: error ? semanticColor.danger : semanticColor.borderSubtle,
            backgroundColor: semanticColor.backgroundElevated,
            color: semanticColor.textPrimary,
            paddingHorizontal: 14,
            fontSize: 16,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <AppText variant="bodySm" color="danger" style={{ marginTop: 4 }}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="bodySm" color="muted" style={{ marginTop: 4 }}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});
