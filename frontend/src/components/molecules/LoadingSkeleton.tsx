import React, { useEffect, useRef, useMemo } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useColors, Colors } from '../../context/ThemeContext';
import { spacing } from '../../theme/spacing';

const SkeletonBlock: React.FC<{
  width: number | string;
  height: number;
  borderRadius?: number;
  opacity: Animated.Value;
  blockColor: string;
}> = ({ width, height, borderRadius = 6, opacity, blockColor }) => (
  <Animated.View
    style={[
      styles.block,
      { width: width as any, height, borderRadius, opacity, backgroundColor: blockColor },
    ]}
  />
);

const LoadingSkeleton: React.FC = () => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 750, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <SkeletonBlock width={38} height={38} borderRadius={19} opacity={opacity} blockColor={colors.surface2} />
        <View style={styles.headerMeta}>
          <SkeletonBlock width="55%" height={12} opacity={opacity} blockColor={colors.surface2} />
          <View style={styles.headerSubRow}>
            <SkeletonBlock width={70} height={10} borderRadius={99} opacity={opacity} blockColor={colors.surface2} />
            <SkeletonBlock width={28} height={10} opacity={opacity} blockColor={colors.surface2} />
          </View>
        </View>
      </View>
      <SkeletonBlock width="100%" height={12} opacity={opacity} blockColor={colors.surface2} />
      <View style={styles.lineGap} />
      <SkeletonBlock width="80%" height={12} opacity={opacity} blockColor={colors.surface2} />
      <View style={styles.lineGap} />
      <SkeletonBlock width="65%" height={12} opacity={opacity} blockColor={colors.surface2} />
      <View style={styles.imageGap} />
      <SkeletonBlock width="100%" height={160} borderRadius={8} opacity={opacity} blockColor={colors.surface2} />
      <View style={styles.footer}>
        <SkeletonBlock width={50} height={10} opacity={opacity} blockColor={colors.surface2} />
        <SkeletonBlock width={50} height={10} opacity={opacity} blockColor={colors.surface2} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  block: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerMeta: {
    flex: 1,
    marginLeft: spacing.md,
    gap: 8,
  },
  headerSubRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  lineGap: { height: 6 },
  imageGap: { height: spacing.md },
  footer: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.lg,
  },
});

function createStyles(c: Colors) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.lg,
      marginBottom: spacing.md,
    },
  });
}

export default LoadingSkeleton;
