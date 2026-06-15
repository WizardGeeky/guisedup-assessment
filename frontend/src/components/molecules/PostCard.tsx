import React, { useState, useRef, useCallback, useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ApiPost } from '../../services/feedApi';
import { interactionApi } from '../../services/interactionApi';
import { useColors, Colors } from '../../context/ThemeContext';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { getAuthenticityLevel, formatTimeAgo } from '../../types';
import Avatar from '../atoms/Avatar';
import Badge from '../atoms/Badge';
import AppText from '../atoms/Text';

interface PostCardProps {
  post: ApiPost;
  relationshipScore?: number;
  onReact?: (postId: string) => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, relationshipScore = 0, onReact }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const hasReactedRef = useRef(false);
  const [hasReacted, setHasReacted] = useState(false);
  const [reactionCount, setReactionCount] = useState(post._count?.interactions ?? 0);

  const heartScale = useRef(new Animated.Value(1)).current;

  const handleReact = useCallback(async () => {
    const nextReacted = !hasReactedRef.current;
    hasReactedRef.current = nextReacted;
    setHasReacted(nextReacted);
    setReactionCount((c) => (nextReacted ? c + 1 : Math.max(0, c - 1)));

    // Bounce animation
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.5, friction: 3, tension: 200, useNativeDriver: true }),
      Animated.spring(heartScale, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
    ]).start();

    if (nextReacted) {
      try { await interactionApi.logInteraction(post.id, 'REACTION'); } catch {}
    }
    onReact?.(post.id);
  }, [post.id, onReact, heartScale]);

  const handleLongPress = useCallback(() => {
    Alert.alert('Post options', undefined, [
      { text: 'Share', onPress: () => {} },
      { text: 'Report', onPress: () => {} },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, []);

  const authLevel = getAuthenticityLevel(post.authenticityScore);
  const authDotColor =
    authLevel === 'high' ? colors.authHigh
    : authLevel === 'medium' ? colors.authMedium
    : colors.authLow;

  return (
    <TouchableOpacity
      activeOpacity={0.97}
      onLongPress={handleLongPress}
      delayLongPress={500}
    >
      <View style={styles.card}>
        <View style={styles.header}>
          <Avatar username={post.author.username} size={38} />
          <View style={styles.headerMeta}>
            <AppText variant="label" style={styles.username}>{post.author.username}</AppText>
            <View style={styles.headerSub}>
              <Badge depth={relationshipScore} />
              <AppText variant="caption" style={styles.time}>{formatTimeAgo(post.createdAt)}</AppText>
            </View>
          </View>
          <View style={[styles.authDot, { backgroundColor: authDotColor }]} />
        </View>

        <AppText variant="body" style={styles.text}>{post.text}</AppText>

        {post.imageUrl !== null && post.imageUrl !== undefined && (
          <View style={[styles.imagePlaceholder, { backgroundColor: colors.surface2 }]} />
        )}

        <View style={styles.footer}>
          {/* Heart */}
          <TouchableOpacity style={styles.footerAction} onPress={handleReact} activeOpacity={0.7}>
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <Ionicons
                name={hasReacted ? 'heart' : 'heart-outline'}
                size={20}
                color={hasReacted ? colors.error : colors.textSecondary}
              />
            </Animated.View>
            <AppText variant="caption" style={styles.footerCount}>{reactionCount}</AppText>
          </TouchableOpacity>

          {/* Comment */}
          <TouchableOpacity style={styles.footerAction} activeOpacity={0.7}>
            <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
            <AppText variant="caption" style={styles.footerCount}>0</AppText>
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity style={styles.footerAction} activeOpacity={0.7}>
            <Ionicons name="arrow-redo-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    headerMeta: { flex: 1, marginLeft: spacing.md },
    username: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold,
      color: c.textPrimary,
      marginBottom: 3,
    },
    headerSub: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    time: { color: c.textMuted, fontSize: typography.sizes.xs },
    authDot: { width: 8, height: 8, borderRadius: 4, marginLeft: spacing.sm },
    text: {
      color: c.textPrimary,
      lineHeight: typography.sizes.md * 1.6,
      marginBottom: spacing.md,
    },
    imagePlaceholder: {
      width: '100%', aspectRatio: 16 / 9, borderRadius: 8, marginBottom: spacing.md,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xl,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    footerAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    footerCount: { color: c.textSecondary, fontSize: typography.sizes.sm },
  });
}

export default PostCard;
