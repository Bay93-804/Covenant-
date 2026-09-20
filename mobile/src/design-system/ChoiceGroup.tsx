import { Pressable, View } from 'react-native';

import { semanticColor } from './tokens';
import { AppText } from './Text';

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface ChoiceGroupProps<T extends string> {
  label: string;
  options: readonly ChoiceOption<T>[];
  value: T | T[] | undefined;
  onChange: (value: T) => void;
  multi?: boolean;
  error?: string;
  required?: boolean;
}

/** Chip/list choice control used throughout onboarding (single or multi-select). */
export function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  multi = false,
  error,
  required,
}: ChoiceGroupProps<T>) {
  const selected = new Set(Array.isArray(value) ? value : value ? [value] : []);

  return (
    <View className="mb-4">
      <AppText variant="caption" color="secondary" style={{ marginBottom: 8 }}>
        {label}
        {required ? ' *' : ''}
      </AppText>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selected.has(option.value);
          return (
            <Pressable
              key={option.value}
              accessibilityRole={multi ? 'checkbox' : 'radio'}
              accessibilityState={{ selected: isSelected, checked: isSelected }}
              accessibilityLabel={option.label}
              onPress={() => onChange(option.value)}
              style={{
                minHeight: 44,
                justifyContent: 'center',
                borderRadius: 999,
                borderWidth: 1.5,
                borderColor: isSelected ? semanticColor.accentPrimary : semanticColor.borderSubtle,
                backgroundColor: isSelected ? semanticColor.accentPrimary : 'transparent',
                paddingHorizontal: 16,
                paddingVertical: 10,
              }}
            >
              <AppText variant="bodySm" color={isSelected ? 'onAccent' : 'primary'} weight="600">
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <AppText variant="bodySm" color="danger" style={{ marginTop: 6 }}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
