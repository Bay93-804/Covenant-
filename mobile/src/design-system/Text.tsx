import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { semanticColor, typography, type TypographyToken } from './tokens';

export type AppTextColor = 'primary' | 'secondary' | 'muted' | 'accent' | 'danger' | 'onAccent';

export interface AppTextProps extends RNTextProps {
  variant?: TypographyToken;
  color?: AppTextColor;
  weight?: '400' | '500' | '600' | '700';
  center?: boolean;
}

const colorMap: Record<AppTextColor, string> = {
  primary: semanticColor.textPrimary,
  secondary: semanticColor.textSecondary,
  muted: semanticColor.textMuted,
  accent: semanticColor.accentPrimary,
  danger: semanticColor.danger,
  onAccent: semanticColor.accentOnAccent,
};

/**
 * Base text primitive for the whole app. Every screen should compose from
 * this rather than raw RN `Text` so the type scale and brand colors stay
 * centralized in `design-system/tokens.ts`.
 */
export function AppText({
  variant = 'body',
  color = 'primary',
  weight,
  center,
  style,
  allowFontScaling = true,
  ...rest
}: AppTextProps) {
  const scale = typography[variant];
  return (
    <RNText
      allowFontScaling={allowFontScaling}
      style={[
        {
          fontSize: scale.fontSize,
          lineHeight: scale.lineHeight,
          fontWeight: weight ?? (scale.fontWeight as '400' | '500' | '600' | '700'),
          letterSpacing: scale.tracking,
          color: colorMap[color],
        },
        center ? { textAlign: 'center' } : null,
        style,
      ]}
      {...rest}
    />
  );
}
