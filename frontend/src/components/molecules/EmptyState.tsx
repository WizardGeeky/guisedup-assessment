import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useColors, Colors } from '../../context/ThemeContext';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import AppText from '../atoms/Text';

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, subtitle }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <AppText style={styles.icon}>{icon}</AppText>
      <AppText variant="h3" style={styles.title}>
        {title}
      </AppText>
      <AppText variant="caption" style={styles.subtitle}>
        {subtitle}
      </AppText>
    </View>
  );
};

function createStyles(c: Colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xxxxl,
      paddingVertical: spacing.xxxxl,
    },
    icon: {
      fontSize: 52,
      marginBottom: spacing.lg,
      textAlign: 'center',
    },
    title: {
      color: c.textPrimary,
      fontWeight: typography.weights.semibold,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    subtitle: {
      color: c.textMuted,
      textAlign: 'center',
      lineHeight: typography.sizes.sm * 1.6,
    },
  });
}

export default EmptyState;
