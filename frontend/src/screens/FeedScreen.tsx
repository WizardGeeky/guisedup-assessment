import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { TabParamList } from '../types';
import { feedApi, RankedPost } from '../services/feedApi';
import { notificationApi } from '../services/notificationApi';
import { useColors, Colors } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import PostList from '../components/organisms/PostList';
import SearchBar from '../components/molecules/SearchBar';
import Avatar from '../components/atoms/Avatar';
import AppText from '../components/atoms/Text';

type FeedNavProp = BottomTabNavigationProp<TabParamList, 'Feed'>;
interface FeedScreenProps { navigation: FeedNavProp; }

const FILTERS = ['for you', 'trending', 'recent'] as const;
type FilterKey = typeof FILTERS[number];

const FeedScreen: React.FC<FeedScreenProps> = ({ navigation }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();
  const { socket } = useSocket();

  const [posts, setPosts] = useState<RankedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activeFilter, setActiveFilter] = useState(0);
  const [hasUnread, setHasUnread] = useState(false);

  const cursorRef = useRef<string | undefined>(undefined);
  const loadingMoreRef = useRef(false);
  const hasLoadedRef = useRef(false);

  // Sort posts client-side based on active filter
  const displayedPosts = useMemo<RankedPost[]>(() => {
    if (activeFilter === 1) {
      // trending: sort by reaction count
      return [...posts].sort(
        (a, b) => (b.post._count?.interactions ?? 0) - (a.post._count?.interactions ?? 0)
      );
    }
    if (activeFilter === 2) {
      // recent: sort by date
      return [...posts].sort(
        (a, b) => new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime()
      );
    }
    return posts; // for you: ranked order from API
  }, [posts, activeFilter]);

  const fetchFeed = useCallback(async (refresh: boolean) => {
    const cursor = refresh ? undefined : cursorRef.current;
    const page = await feedApi.getFeed(cursor);
    if (refresh) setPosts(page.posts);
    else setPosts((prev) => [...prev, ...page.posts]);
    cursorRef.current = page.nextCursor ?? undefined;
    setHasMore(page.hasMore);
  }, []);

  useFocusEffect(
    useCallback(() => {
      cursorRef.current = undefined;
      setHasMore(true);
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        setIsLoading(true);
        void fetchFeed(true).finally(() => setIsLoading(false));
      } else {
        setIsRefreshing(true);
        void fetchFeed(true).finally(() => setIsRefreshing(false));
      }

      // Fetch real unread notification count
      void notificationApi.getUnreadCount().then((count) => setHasUnread(count > 0)).catch(() => {});

      // Poll every 30s
      const poll = setInterval(() => {
        if (loadingMoreRef.current) return;
        cursorRef.current = undefined;
        void fetchFeed(true);
      }, 30_000);

      return () => clearInterval(poll);
    }, [fetchFeed])
  );

  // Real-time: mark bell as unread when new notification arrives
  useEffect(() => {
    if (!socket) return;
    const handler = () => setHasUnread(true);
    socket.on('new-notification', handler);
    return () => { socket.off('new-notification', handler); };
  }, [socket]);

  const handleLoadMore = useCallback(() => {
    if (loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    void fetchFeed(false).finally(() => { loadingMoreRef.current = false; });
  }, [hasMore, fetchFeed]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    cursorRef.current = undefined;
    setHasMore(true);
    void fetchFeed(true).finally(() => setIsRefreshing(false));
  }, [fetchFeed]);

  const handleSearchPress = useCallback(() => navigation.navigate('Search'), [navigation]);
  const handleNotificationsPress = useCallback(() => {
    setHasUnread(false);
    navigation.navigate('Notifications');
  }, [navigation]);
  const handleCreatePress = useCallback(() => navigation.navigate('Create'), [navigation]);

  const isEmpty = !isLoading && displayedPosts.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} activeOpacity={0.8}>
            <Avatar username={user?.username ?? ''} size={42} imageUrl={user?.avatarUrl} />
          </TouchableOpacity>
          <View>
            <AppText style={styles.headerGreeting}>welcome back</AppText>
            <AppText style={styles.headerUsername}>@{user?.username ?? 'you'}</AppText>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.notifBtn} onPress={handleNotificationsPress} activeOpacity={0.7}>
            <Ionicons name="notifications-outline" size={21} color={colors.textPrimary} />
            {hasUnread && <View style={styles.notifDot} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Search ── */}
      <View style={styles.searchWrapper}>
        <SearchBar value="" onChangeText={() => {}} onClear={() => {}} placeholder="search people, posts..." />
        <TouchableOpacity style={styles.searchOverlay} onPress={handleSearchPress} activeOpacity={1} />
      </View>

      {/* ── Filter Chips ── */}
      <View style={styles.filterRow}>
        {FILTERS.map((label: FilterKey, i) => (
          <TouchableOpacity
            key={label}
            style={[styles.chip, activeFilter === i && { backgroundColor: colors.accent, borderColor: colors.accent }]}
            onPress={() => setActiveFilter(i)}
            activeOpacity={0.7}
          >
            {i === 1 && <Ionicons name="flame-outline" size={13} color={activeFilter === i ? '#FFF' : colors.textMuted} style={{ marginRight: 4 }} />}
            {i === 2 && <Ionicons name="time-outline" size={13} color={activeFilter === i ? '#FFF' : colors.textMuted} style={{ marginRight: 4 }} />}
            <AppText style={[styles.chipText, activeFilter === i && styles.chipTextActive]}>
              {label}
            </AppText>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.divider} />

      {/* ── Content ── */}
      {(isEmpty || isLoading) && !isRefreshing ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <EmptyCTA onPress={handleCreatePress} colors={colors} styles={styles} />
        </ScrollView>
      ) : (
        <PostList
          posts={displayedPosts}
          onLoadMore={handleLoadMore}
          onRefresh={handleRefresh}
          isLoading={isLoading}
          isRefreshing={isRefreshing}
          hasMore={hasMore}
        />
      )}
    </SafeAreaView>
  );
};

/* ── Empty CTA ── */
const EmptyCTA: React.FC<{
  onPress: () => void;
  colors: Colors;
  styles: ReturnType<typeof createStyles>;
}> = ({ onPress, colors, styles }) => {
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -6, duration: 900, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [bounceAnim]);

  return (
    <View style={[styles.ctaCard, { backgroundColor: colors.surface, borderColor: `${colors.accent}22` }]}>
      <Animated.View style={{ transform: [{ translateY: bounceAnim }] }}>
        <Ionicons name="pencil-outline" size={36} color={colors.accent} />
      </Animated.View>
      <AppText style={[styles.ctaTitle, { color: colors.textPrimary }]}>be the first to post</AppText>
      <AppText style={[styles.ctaSub, { color: colors.textMuted }]}>
        real moments, real people.{'\n'}start the conversation today.
      </AppText>
      <TouchableOpacity
        style={[styles.ctaBtn, { backgroundColor: colors.accent }]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <AppText style={styles.ctaBtnText}>create a post</AppText>
        <Ionicons name="arrow-forward" size={16} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
};

function createStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },

    // Header
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    headerGreeting: { fontSize: typography.sizes.xs, color: c.textMuted },
    headerUsername: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, color: c.textPrimary },
    notifBtn: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center',
    },
    notifDot: {
      position: 'absolute', top: 9, right: 9,
      width: 7, height: 7, borderRadius: 4,
      backgroundColor: c.accent, borderWidth: 1.5, borderColor: c.surface2,
    },

    // Search
    searchWrapper: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, position: 'relative' },
    searchOverlay: { position: 'absolute', top: 0, left: spacing.lg, right: spacing.lg, bottom: spacing.sm },

    // Filter chips — horizontal pill row
    filterRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md,
    },
    chip: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: spacing.md, paddingVertical: 8,
      borderRadius: 22, backgroundColor: c.surface,
      borderWidth: 1.5, borderColor: c.border,
    },
    chipText: { fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: c.textSecondary },
    chipTextActive: { color: '#FFF', fontWeight: typography.weights.semibold },

    divider: { height: 1, backgroundColor: c.border },

    scroll: { flex: 1 },
    scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxxxl },

    // CTA card
    ctaCard: {
      borderRadius: 20, borderWidth: 1.5,
      padding: spacing.xl, alignItems: 'center',
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    },
    ctaTitle: {
      fontSize: typography.sizes.lg, fontWeight: typography.weights.bold,
      marginTop: spacing.md, marginBottom: spacing.xs,
    },
    ctaSub: {
      fontSize: typography.sizes.sm, textAlign: 'center',
      lineHeight: (typography.sizes.sm ?? 14) * 1.7, marginBottom: spacing.lg,
    },
    ctaBtn: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
      borderRadius: 14,
      shadowColor: c.accent, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
    },
    ctaBtnText: { color: '#FFF', fontSize: typography.sizes.md, fontWeight: typography.weights.semibold },
  });
}

export default FeedScreen;
