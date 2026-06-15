import React, { useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { FlashList, ListRenderItemInfo } from '@shopify/flash-list';
import { RankedPost } from '../../services/feedApi';
import { useColors } from '../../context/ThemeContext';
import { spacing } from '../../theme/spacing';
import PostCard from '../molecules/PostCard';
import LoadingSkeleton from '../molecules/LoadingSkeleton';
import EmptyState from '../molecules/EmptyState';

interface PostListProps {
  posts: RankedPost[];
  onLoadMore: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  isRefreshing: boolean;
  hasMore: boolean;
}

const SKELETON_COUNT = 3;
const ESTIMATED_ITEM_SIZE = 220;

const PostList: React.FC<PostListProps> = ({
  posts,
  onLoadMore,
  onRefresh,
  isLoading,
  isRefreshing,
  hasMore,
}) => {
  const colors = useColors();

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<RankedPost>) => (
      <PostCard
        post={item.post}
        relationshipScore={item.scores.relationship}
        onReact={() => {}}
      />
    ),
    [],
  );

  const keyExtractor = useCallback((item: RankedPost) => item.post.id, []);

  const ListFooterComponent = useCallback(() => {
    if (!hasMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  }, [hasMore, colors.accent]);

  const ListEmptyComponent = useCallback(() => {
    if (isLoading) return null;
    return (
      <EmptyState
        icon="✨"
        title="nothing here yet"
        subtitle="be the first to post something real"
      />
    );
  }, [isLoading]);

  if (isLoading && posts.length === 0) {
    return (
      <View style={styles.skeletonContainer}>
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <LoadingSkeleton key={i} />
        ))}
      </View>
    );
  }

  return (
    <FlashList
      data={posts}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      estimatedItemSize={ESTIMATED_ITEM_SIZE}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.4}
      onRefresh={onRefresh}
      refreshing={isRefreshing}
      ListFooterComponent={ListFooterComponent}
      ListEmptyComponent={ListEmptyComponent}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  skeletonContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxxl,
  },
  footer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
});

export default PostList;
