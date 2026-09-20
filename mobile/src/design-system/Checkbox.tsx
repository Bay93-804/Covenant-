import { Pressable, View } from 'react-native';

import { semanticColor } from './tokens';
import { AppText } from './Text';

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  error?: string;
}

export function Checkbox({ label, checked, onChange, error }: CheckboxProps) {
  return (
    <View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        onPress={() => onChange(!checked)}
        className="flex-row items-center gap-3 py-2"
        style={{ minHeight: 44 }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            borderWidth: 1.5,
            borderColor: checked ? semanticColor.accentPrimary : semanticColor.borderSubtle,
            backgroundColor: checked ? semanticColor.accentPrimary : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {checked ? (
            <AppText variant="caption" color="onAccent" weight="700">
              ✓
            </AppText>
          ) : null}
        </View>
        <AppText variant="body" color="primary" style={{ flex: 1 }}>
          {label}
        </AppText>
      </Pressable>
      {error ? (
        <AppText variant="bodySm" color="danger">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
