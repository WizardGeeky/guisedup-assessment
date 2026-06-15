import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { TabParamList } from '../types';
import { feedApi, RankedPost } from '../services/feedApi';
import { useColors, Colors } from '../context/ThemeContext';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import PostList from '../components/organisms/PostList';
import SearchBar from '../components/molecules/SearchBar';
import AppText from '../components/atoms/Text';

type FeedNavProp = BottomTabNavigationProp<TabParamList, 'Feed'>;

interface FeedScreenProps {
  navigation: FeedNavProp;
}

const FeedScreen: React.FC<FeedScreenProps> = ({ navigation }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [posts, setPosts] = useState<RankedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<string | undefined>(undefined);
  const loadingMoreRef = useRef(false);

  const fetchFeed = useCallback(async (refresh: boolean) => {
    const cursor = refresh ? undefined : cursorRef.current;
    const page = await feedApi.getFeed(cursor);
    if (refresh) {
      setPosts(page.posts);
    } else {
      setPosts((prev) => [...prev, ...page.posts]);
    }
    cursorRef.current = page.nextCursor ?? undefined;
    setHasMore(page.hasMore);
  }, []);

  useEffect(() => {
    void fetchFeed(true).finally(() => setIsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoadMore = useCallback(() => {
    if (loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    void fetchFeed(false).finally(() => {
      loadingMoreRef.current = false;
    });
  }, [hasMore, fetchFeed]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    cursorRef.current = undefined;
    setHasMore(true);
    void fetchFeed(true).finally(() => setIsRefreshing(false));
  }, [fetchFeed]);

  const handleSearchPress = useCallback(() => {
    navigation.navigate('Search');
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <AppText variant="h3" style={styles.headerTitle}>
          guised up
        </AppText>
      </View>

      <View style={styles.searchWrapper}>
        <SearchBar
          value=""
          onChangeText={() => {}}
          onClear={() => {}}
          placeholder="search people, posts..."
        />
        <TouchableOpacity
          style={styles.searchOverlay}
          onPress={handleSearchPress}
          activeOpacity={1}
        />
      </View>

      <PostList
        posts={posts}
        onLoadMore={handleLoadMore}
        onRefresh={handleRefresh}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        hasMore={hasMore}
      />
    </SafeAreaView>
  );
};

function createStyles(c: Colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    },
    headerTitle: {
      color: c.accent,
      fontWeight: typography.weights.bold,
      letterSpacing: 0.5,
    },
    searchWrapper: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      position: 'relative',
    },
    searchOverlay: {
      position: 'absolute',
      top: 0,
      left: spacing.lg,
      right: spacing.lg,
      bottom: spacing.md,
    },
  });
}

export default FeedScreen;
