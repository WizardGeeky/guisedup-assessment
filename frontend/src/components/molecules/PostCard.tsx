import React, { useState, useRef, useCallback, useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Alert, Image, Platform } from 'react-native';
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
import CommentsSheet from './CommentsSheet';

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
  const [commentCount, setCommentCount] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const heartScale = useRef(new Animated.Value(1)).current;

  const handleReact = useCallback(async () => {
    const nextReacted = !hasReactedRef.current;
    hasReactedRef.current = nextReacted;
    setHasReacted(nextReacted);
    setReactionCount((c) => (nextReacted ? c + 1 : Math.max(0, c - 1)));

    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.45, friction: 3, tension: 220, useNativeDriver: true }),
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
  const authColor =
    authLevel === 'high' ? colors.authHigh
    : authLevel === 'medium' ? colors.authMedium
    : colors.authLow;
  const authLabel = authLevel === 'high' ? 'authentic' : authLevel === 'medium' ? 'mixed' : 'low';

  return (
    <TouchableOpacity activeOpacity={0.96} onLongPress={handleLongPress} delayLongPress={500}>
      <View style={styles.card}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Avatar username={post.author.username} size={44} imageUrl={post.author.avatarUrl} />
          <View style={styles.headerMeta}>
            <AppText style={styles.username}>{post.author.username}</AppText>
            <View style={styles.headerSub}>
              <Badge depth={relationshipScore} />
              <AppText style={styles.time}>{formatTimeAgo(post.createdAt)}</AppText>
            </View>
          </View>
          <View style={[styles.authPill, { backgroundColor: `${authColor}18` }]}>
            <View style={[styles.authDot, { backgroundColor: authColor }]} />
            <AppText style={[styles.authLabel, { color: authColor }]}>{authLabel}</AppText>
          </View>
        </View>

        {/* ── Text ── */}
        <AppText style={styles.text}>{post.text}</AppText>

        {/* ── Image ── */}
        {post.imageUrl ? (
          <Image source={{ uri: post.imageUrl }} style={styles.postImage} resizeMode="cover" />
        ) : null}

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleReact} activeOpacity={0.7}>
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <Ionicons
                name={hasReacted ? 'heart' : 'heart-outline'}
                size={20}
                color={hasReacted ? '#FF3B30' : colors.textSecondary}
              />
            </Animated.View>
            {reactionCount > 0 && (
              <AppText style={[styles.actionCount, hasReacted && { color: '#FF3B30' }]}>
                {reactionCount}
              </AppText>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => setCommentsOpen(true)} activeOpacity={0.7}>
            <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
            {commentCount > 0 && <AppText style={styles.actionCount}>{commentCount}</AppText>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-redo-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.viewsRight}>
            <Ionicons name="eye-outline" size={14} color={colors.textMuted} />
            <AppText style={styles.viewCount}>{post.viewCount ?? 0}</AppText>
          </View>
        </View>
      </View>

      <CommentsSheet
        postId={post.id}
        visible={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        onCountChange={setCommentCount}
      />
    </TouchableOpacity>
  );
};

function createStyles(c: Colors) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: spacing.lg,
      marginBottom: spacing.md,
      // Elevated shadow — no border
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 4,
      ...(Platform.OS === 'web' ? { boxShadow: '0 3px 10px rgba(0,0,0,0.1)' } as any : {}),
    },

    // Header
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    headerMeta: { flex: 1, marginLeft: spacing.md },
    username: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold,
      color: c.textPrimary,
      marginBottom: 3,
    },
    headerSub: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    time: { color: c.textMuted, fontSize: typography.sizes.xs },
    authPill: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10,
    },
    authDot: { width: 6, height: 6, borderRadius: 3 },
    authLabel: { fontSize: 10, fontWeight: typography.weights.semibold },

    // Content
    text: {
      color: c.textPrimary,
      fontSize: typography.sizes.md,
      lineHeight: typography.sizes.md * 1.65,
      marginBottom: spacing.md,
    },
    postImage: {
      width: '100%', aspectRatio: 16 / 9,
      borderRadius: 14, marginBottom: spacing.md,
    },

    // Footer
    footer: {
      flexDirection: 'row', alignItems: 'center',
      gap: spacing.lg, paddingTop: spacing.sm,
    },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    actionCount: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
      color: c.textSecondary,
    },
    viewsRight: {
      flexDirection: 'row', alignItems: 'center',
      gap: 4, marginLeft: 'auto',
    },
    viewCount: { fontSize: 11, color: c.textMuted },
  });
}

export default PostCard;
