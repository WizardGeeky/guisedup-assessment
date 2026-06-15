import React, { useMemo } from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { useColors, Colors } from '../../context/ThemeContext';
import { typography } from '../../theme/typography';

type TextVariant = 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'label';

interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: string;
  children?: React.ReactNode;
}

const AppText: React.FC<AppTextProps> = ({
  variant = 'body',
  color,
  style,
  children,
  ...rest
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Text
      style={[styles.base, styles[variant], color ? { color } : undefined, style]}
      {...rest}
    >
      {children}
    </Text>
  );
};

function createStyles(c: Colors) {
  return StyleSheet.create({
    base: {
      color: c.textPrimary,
    },
    h1: {
      fontSize: typography.sizes.xxxl,
      fontWeight: typography.weights.bold,
      lineHeight: typography.sizes.xxxl * typography.lineHeights.tight,
      letterSpacing: -0.5,
    },
    h2: {
      fontSize: typography.sizes.xxl,
      fontWeight: typography.weights.bold,
      lineHeight: typography.sizes.xxl * typography.lineHeights.tight,
      letterSpacing: -0.3,
    },
    h3: {
      fontSize: typography.sizes.xl,
      fontWeight: typography.weights.semibold,
      lineHeight: typography.sizes.xl * typography.lineHeights.normal,
    },
    body: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.regular,
      lineHeight: typography.sizes.md * typography.lineHeights.normal,
    },
    caption: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.regular,
      lineHeight: typography.sizes.sm * typography.lineHeights.normal,
      color: c.textSecondary,
    },
    label: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
      lineHeight: typography.sizes.sm * typography.lineHeights.normal,
    },
  });
}

export default AppText;
