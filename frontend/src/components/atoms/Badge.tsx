import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { RelationshipDepth, getRelationshipDepth } from '../../types';
import { useColors, Colors } from '../../context/ThemeContext';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import AppText from './Text';

interface BadgeProps {
  depth: RelationshipDepth | number;
}

const Badge: React.FC<BadgeProps> = ({ depth }) => {
  const colors = useColors();
  const depthKey: RelationshipDepth =
    typeof depth === 'number' ? getRelationshipDepth(depth) : depth;

  const config = useMemo(() => ({
    close_friend: {
      label: 'Close Friend',
      bg: 'rgba(255, 87, 34, 0.12)',
      text: colors.accent,
      border: 'rgba(255, 87, 34, 0.35)',
    },
    friend: {
      label: 'Friend',
      bg: colors.surface2,
      text: colors.textSecondary,
      border: colors.border,
    },
    acquaintance: {
      label: 'Acquaintance',
      bg: 'transparent',
      text: colors.textMuted,
      border: colors.border,
    },
  }), [colors]);

  const item = config[depthKey];

  return (
    <View style={[styles.container, { backgroundColor: item.bg, borderColor: item.border }]}>
      <AppText variant="caption" style={[styles.text, { color: item.text }]}>
        {item.label}
      </AppText>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 99,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
});

export default Badge;
