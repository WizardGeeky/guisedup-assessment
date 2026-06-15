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
import { useColors, Colors } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import PostList from '../components/organisms/PostList';
import SearchBar from '../components/molecules/SearchBar';
import AppText from '../components/atoms/Text';

type FeedNavProp = BottomTabNavigationProp<TabParamList, 'Feed'>;
interface FeedScreenProps { navigation: FeedNavProp; }

const FILTERS = ['for you', 'following', 'trending', 'recent'];

const TRENDING_TOPICS = [
  { tag: '#authentic', icon: 'heart-outline', posts: '2.4k posts' },
  { tag: '#realmoments', icon: 'camera-outline', posts: '1.8k posts' },
  { tag: '#unfiltered', icon: 'aperture-outline', posts: '3.1k posts' },
  { tag: '#reallife', icon: 'sunny-outline', posts: '980 posts' },
  { tag: '#connect', icon: 'people-outline', posts: '1.2k posts' },
  { tag: '#honest', icon: 'chatbubble-outline', posts: '760 posts' },
];

const FeedScreen: React.FC<FeedScreenProps> = ({ navigation }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();

  const [posts, setPosts] = useState<RankedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activeFilter, setActiveFilter] = useState(0);
  const cursorRef = useRef<string | undefined>(undefined);
  const loadingMoreRef = useRef(false);
  const hasLoadedRef = useRef(false);

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
    }, [fetchFeed])
  );

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
  const handleNotificationsPress = useCallback(() => navigation.navigate('Notifications'), [navigation]);
  const handleCreatePress = useCallback(() => navigation.navigate('Create'), [navigation]);

  const isEmpty = !isLoading && posts.length === 0;

  const initials = user?.username ? user.username[0].toUpperCase() : 'G';
  const displayName = user?.username ? `@${user.username}` : 'guised up';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarCircle}>
            <AppText style={styles.avatarLetter}>{initials}</AppText>
          </View>
          <View>
            <AppText style={styles.headerGreeting}>welcome back</AppText>
            <AppText style={styles.headerUsername}>{displayName}</AppText>
          </View>
        </View>
        <TouchableOpacity style={styles.notifBtn} onPress={handleNotificationsPress} activeOpacity={0.7}>
          <Ionicons name="notifications-outline" size={21} color={colors.textPrimary} />
          <View style={styles.notifDot} />
        </TouchableOpacity>
      </View>

      {/* ── Search ── */}
      <View style={styles.searchWrapper}>
        <SearchBar value="" onChangeText={() => {}} onClear={() => {}} placeholder="search people, posts..." />
        <TouchableOpacity style={styles.searchOverlay} onPress={handleSearchPress} activeOpacity={1} />
      </View>

      {/* ── Filter Chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterContent}
      >
        {FILTERS.map((label, i) => (
          <TouchableOpacity
            key={label}
            style={[styles.chip, activeFilter === i && styles.chipActive]}
            onPress={() => setActiveFilter(i)}
            activeOpacity={0.7}
          >
            <AppText style={[styles.chipText, activeFilter === i && styles.chipTextActive]}>
              {label}
            </AppText>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.divider} />

      {/* ── Content ── */}
      {(isEmpty || isLoading) && !isRefreshing ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Trending topics section */}
          <View style={styles.sectionHeader}>
            <Ionicons name="trending-up-outline" size={16} color={colors.accent} />
            <AppText style={styles.sectionTitle}>trending topics</AppText>
            <View style={[styles.comingSoonBadge, { backgroundColor: `${colors.accent}14` }]}>
              <AppText style={[styles.comingSoonText, { color: colors.accent }]}>coming soon</AppText>
            </View>
          </View>

          <View style={styles.topicsGrid}>
            {TRENDING_TOPICS.map((t, i) => (
              <TrendingCard key={t.tag} topic={t} index={i} colors={colors} styles={styles} />
            ))}
          </View>

          {/* CTA */}
          <EmptyCTA onPress={handleCreatePress} colors={colors} styles={styles} />
        </ScrollView>
      ) : (
        <PostList
          posts={posts}
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

/* ── Trending topic card ── */
const TrendingCard: React.FC<{
  topic: { tag: string; icon: string; posts: string };
  index: number;
  colors: Colors;
  styles: ReturnType<typeof createStyles>;
}> = ({ topic, index, colors, styles }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay: index * 80, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, delay: index * 80, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim, index]);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], width: '48%' }}>
      <View style={[styles.topicCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.topicIconWrap, { backgroundColor: `${colors.accent}12` }]}>
          <Ionicons name={topic.icon as any} size={18} color={colors.accent} />
        </View>
        <AppText style={[styles.topicTag, { color: colors.textPrimary }]}>{topic.tag}</AppText>
        <AppText style={[styles.topicPosts, { color: colors.textMuted }]}>{topic.posts}</AppText>
      </View>
    </Animated.View>
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
        Animated.timing(bounceAnim, { toValue: -5, duration: 800, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [bounceAnim]);

  return (
    <View style={[styles.ctaCard, { backgroundColor: colors.surface, borderColor: `${colors.accent}22` }]}>
      <Animated.View style={{ transform: [{ translateY: bounceAnim }] }}>
        <Ionicons name="pencil-outline" size={32} color={colors.accent} />
      </Animated.View>
      <AppText style={[styles.ctaTitle, { color: colors.textPrimary }]}>
        be the first to post
      </AppText>
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
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatarCircle: {
      width: 40, height: 40, borderRadius: 12, backgroundColor: c.accent,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: c.accent, shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
    },
    avatarLetter: { fontSize: 18, fontWeight: typography.weights.bold, color: '#FFF', lineHeight: 22 },
    headerGreeting: { fontSize: typography.sizes.xs, color: c.textMuted },
    headerUsername: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, color: c.textPrimary },
    notifBtn: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: c.surface2,
      alignItems: 'center', justifyContent: 'center',
    },
    notifDot: {
      position: 'absolute', top: 9, right: 9,
      width: 7, height: 7, borderRadius: 4,
      backgroundColor: c.accent, borderWidth: 1.5, borderColor: c.surface2,
    },

    // Search
    searchWrapper: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, position: 'relative' },
    searchOverlay: { position: 'absolute', top: 0, left: spacing.lg, right: spacing.lg, bottom: spacing.sm },

    // Filter chips
    filterRow: { flexGrow: 0 },
    filterContent: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md },
    chip: {
      paddingHorizontal: spacing.md, paddingVertical: 7,
      borderRadius: 20, backgroundColor: c.surface,
      borderWidth: 1.5, borderColor: c.border,
    },
    chipActive: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: c.textSecondary },
    chipTextActive: { color: '#FFF', fontWeight: typography.weights.semibold },

    divider: { height: 1, backgroundColor: c.border },

    scroll: { flex: 1 },
    scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxxxl },

    // Section header
    sectionHeader: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      marginBottom: spacing.md,
    },
    sectionTitle: {
      fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold,
      color: c.textPrimary, flex: 1,
    },
    comingSoonBadge: {
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    },
    comingSoonText: { fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold },

    // Topic grid
    topicsGrid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
      marginBottom: spacing.xl,
    },
    topicCard: {
      borderRadius: 14, borderWidth: 1, padding: spacing.md,
    },
    topicIconWrap: {
      width: 36, height: 36, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    topicTag: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, marginBottom: 3 },
    topicPosts: { fontSize: typography.sizes.xs },

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
      lineHeight: typography.sizes.sm * 1.7, marginBottom: spacing.lg,
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
