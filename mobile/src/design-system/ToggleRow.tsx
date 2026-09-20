import { Switch, View } from 'react-native';

import { color, semanticColor } from './tokens';
import { AppText } from './Text';

interface ToggleRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}

export function ToggleRow({ label, description, value, onValueChange }: ToggleRowProps) {
  return (
    <View className="flex-row items-center justify-between py-3" style={{ minHeight: 44 }}>
      <View className="flex-1 pr-4">
        <AppText variant="body" color="primary">
          {label}
        </AppText>
        {description ? (
          <AppText variant="bodySm" color="muted" style={{ marginTop: 2 }}>
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: color.navy[600], true: semanticColor.accentPrimary }}
        thumbColor={color.bone[100]}
        ios_backgroundColor={color.navy[600]}
        accessibilityLabel={label}
      />
    </View>
  );
}
