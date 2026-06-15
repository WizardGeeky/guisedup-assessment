import React, { useMemo } from 'react';
import {
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useColors, Colors } from '../../context/ThemeContext';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import AppText from './Text';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isDisabled = disabled || loading;

  const containerStyles: ViewStyle[] = [styles.base, styles[variant]];
  if (isDisabled) containerStyles.push(styles.disabled);
  if (style) containerStyles.push(style);

  const textColor =
    variant === 'primary'
      ? '#FFFFFF'
      : variant === 'secondary'
      ? colors.accent
      : colors.textSecondary;

  return (
    <TouchableOpacity
      style={containerStyles}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#FFFFFF' : colors.accent}
        />
      ) : (
        <AppText variant="label" style={[styles.text, { color: textColor }]}>
          {title}
        </AppText>
      )}
    </TouchableOpacity>
  );
};

function createStyles(c: Colors) {
  return StyleSheet.create({
    base: {
      height: 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    primary: {
      backgroundColor: c.accent,
    },
    secondary: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: c.accent,
    },
    ghost: {
      backgroundColor: 'transparent',
    },
    disabled: {
      opacity: 0.45,
    },
    text: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold,
      letterSpacing: 0.3,
    },
  });
}

export default Button;
