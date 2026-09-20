import { Pressable, View } from 'react-native';

import { semanticColor } from './tokens';
import { AppText } from './Text';

/** 1-5 readiness/quality/technique rating control — big touch targets, no icons that read as gamification. */
export function RatingScale({
  label,
  value,
  onChange,
  max = 5,
}: {
  label: string;
  value: number | null;
  onChange: (next: number) => void;
  max?: number;
}) {
  return (
    <View className="mb-4">
      <AppText variant="caption" color="secondary" style={{ marginBottom: 8 }}>
        {label}
      </AppText>
      <View className="flex-row gap-2">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
          const selected = value === n;
          return (
            <Pressable
              key={n}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${label}: ${n}`}
              onPress={() => onChange(n)}
              style={{
                flex: 1,
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
                borderWidth: 1.5,
                borderColor: selected ? semanticColor.accentPrimary : semanticColor.borderSubtle,
                backgroundColor: selected ? semanticColor.accentPrimary : 'transparent',
              }}
            >
              <AppText variant="button" color={selected ? 'onAccent' : 'primary'}>
                {n}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
