import { useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, type PressableProps } from 'react-native';

import { semanticColor } from './tokens';
import { AppText } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends PropsWithChildren, Pick<PressableProps, 'onPress' | 'testID'> {
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
}

const variantStyles: Record<
  ButtonVariant,
  {
    bg: string;
    bgPressed: string;
    border?: string;
    textColor: 'onAccent' | 'primary' | 'secondary' | 'danger';
  }
> = {
  primary: {
    bg: semanticColor.accentPrimary,
    bgPressed: semanticColor.accentPrimaryPressed,
    textColor: 'onAccent',
  },
  secondary: {
    bg: 'transparent',
    bgPressed: semanticColor.surfaceCard,
    border: semanticColor.borderStrong,
    textColor: 'primary',
  },
  ghost: {
    bg: 'transparent',
    bgPressed: semanticColor.surfaceCard,
    textColor: 'secondary',
  },
  danger: {
    bg: 'transparent',
    bgPressed: semanticColor.surfaceCard,
    border: semanticColor.danger,
    textColor: 'danger',
  },
};

/**
 * Primary interactive control. Meets the ≥44pt touch-target requirement via
 * minHeight, and exposes `accessibilityRole="button"` + a label so it works
 * cleanly under VoiceOver/TalkBack.
 */
export function Button({
  children,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = true,
  onPress,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  const [pressed, setPressed] = useState(false);
  const styles = variantStyles[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        typeof children === 'string' ? (accessibilityLabel ?? children) : accessibilityLabel
      }
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
      testID={testID}
      hitSlop={8}
      style={{
        minHeight: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        paddingHorizontal: 20,
        alignSelf: fullWidth ? 'stretch' : 'flex-start',
        backgroundColor: pressed ? styles.bgPressed : styles.bg,
        borderWidth: styles.border ? 1.5 : 0,
        borderColor: styles.border,
        opacity: isDisabled ? 0.5 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? semanticColor.accentOnAccent : semanticColor.accentPrimary}
        />
      ) : typeof children === 'string' ? (
        <AppText variant="button" color={styles.textColor}>
          {children}
        </AppText>
      ) : (
        children
      )}
    </Pressable>
  );
}
