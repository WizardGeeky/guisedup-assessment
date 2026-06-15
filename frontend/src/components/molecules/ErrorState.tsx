import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import AppText from '../atoms/Text';
import Button from '../atoms/Button';

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => {
  return (
    <View style={styles.container}>
      <AppText style={styles.icon}>⚠️</AppText>
      <AppText variant="h3" style={styles.title}>
        something went wrong
      </AppText>
      <AppText variant="caption" style={styles.message}>
        {message}
      </AppText>
      <Button
        title="try again"
        onPress={onRetry}
        variant="secondary"
        style={styles.button}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxxl,
    paddingVertical: spacing.xxxxl,
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: typography.sizes.sm * 1.6,
    marginBottom: spacing.xl,
  },
  button: {
    minWidth: 140,
  },
});

export default ErrorState;
