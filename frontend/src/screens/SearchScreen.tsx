import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { TabParamList } from '../types';
import { useColors, Colors } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { searchApi, SearchResult } from '../services/searchApi';
import { formatTimeAgo } from '../types';
import SearchBar from '../components/molecules/SearchBar';
import Avatar from '../components/atoms/Avatar';
import AppText from '../components/atoms/Text';

type SearchNavProp = BottomTabNavigationProp<TabParamList, 'Search'>;
interface SearchScreenProps { navigation: SearchNavProp; }

const DEBOUNCE_MS = 500;

const RECENT_TAGS = ['#authentic', '#reallife', '#moments', '#unfiltered', '#connect', '#honest'];

const SearchScreen: React.FC<SearchScreenProps> = ({ navigation }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (!trimmed) { setResults([]); setIsSearching(false); return; }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchApi.search(trimmed);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const handleClear = useCallback(() => { setQuery(''); setResults([]); }, []);

  const isEmpty = query.trim().length === 0;
  const initials = user?.username ? user.username[0].toUpperCase() : 'G';
  const displayName = user?.username ? `@${user.username}` : 'guised up';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── Top bar (matches home) ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.navigate('Feed')} activeOpacity={0.7} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.avatarCircle}>
            <AppText style={styles.avatarLetter}>{initials}</AppText>
          </View>
          <View>
            <AppText style={styles.headerGreeting}>search</AppText>
            <AppText style={styles.headerUsername}>{displayName}</AppText>
          </View>
        </View>
        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => navigation.navigate('Notifications')}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={21} color={colors.textPrimary} />
          <View style={styles.notifDot} />
        </TouchableOpacity>
      </View>

      {/* ── Search bar ── */}
      <View style={styles.searchWrapper}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          onClear={handleClear}
          placeholder="search people, posts, topics..."
        />
      </View>

      <View style={styles.divider} />

      {/* ── Content ── */}
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
      >
        {isEmpty ? (
          /* Empty — show trending tags */
          <View style={styles.emptyContent}>
            <View style={styles.sectionHeader}>
              <Ionicons name="flame-outline" size={15} color={colors.accent} />
              <AppText style={styles.sectionTitle}>trending topics</AppText>
            </View>
            <View style={styles.tagsWrap}>
              {RECENT_TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[styles.tagChip, { backgroundColor: `${colors.accent}12`, borderColor: `${colors.accent}20` }]}
                  onPress={() => setQuery(tag)}
                  activeOpacity={0.7}
                >
                  <AppText style={[styles.tagText, { color: colors.accent }]}>{tag}</AppText>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.hintCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="search-outline" size={28} color={colors.textMuted} />
              <AppText style={[styles.hintTitle, { color: colors.textPrimary }]}>find real moments</AppText>
              <AppText style={[styles.hintSub, { color: colors.textMuted }]}>
                search by keyword, username or topic to discover authentic posts.
              </AppText>
            </View>
          </View>
        ) : isSearching ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="small" color={colors.accent} />
            <AppText style={[styles.loadingText, { color: colors.textMuted }]}>searching…</AppText>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.noResults}>
            <Ionicons name="search-outline" size={36} color={colors.textMuted} />
            <AppText style={[styles.noResultsTitle, { color: colors.textPrimary }]}>no results</AppText>
            <AppText style={[styles.noResultsSub, { color: colors.textMuted }]}>
              nothing found for "{query}"
            </AppText>
          </View>
        ) : (
          <View style={styles.resultsSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="layers-outline" size={14} color={colors.textMuted} />
              <AppText style={styles.sectionTitle}>{results.length} result{results.length !== 1 ? 's' : ''}</AppText>
            </View>
            {results.map((result) => (
              <TouchableOpacity key={result.post.id} style={[styles.postResult, { borderBottomColor: colors.border }]} activeOpacity={0.7}>
                <Avatar username={result.post.author.username} size={40} />
                <View style={styles.postResultMeta}>
                  <View style={styles.postResultHeader}>
                    <AppText style={[styles.postResultUser, { color: colors.textPrimary }]}>
                      {result.post.author.username}
                    </AppText>
                    <AppText style={[styles.postResultTime, { color: colors.textMuted }]}>
                      {formatTimeAgo(result.post.createdAt)}
                    </AppText>
                  </View>
                  <AppText style={[styles.postResultText, { color: colors.textSecondary }]} numberOfLines={2}>
                    {result.post.text}
                  </AppText>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

function createStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },

    // Header — matches FeedScreen
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    backBtn: {
      width: 38, height: 38, borderRadius: 12,
      backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center',
    },
    avatarCircle: {
      width: 36, height: 36, borderRadius: 10, backgroundColor: c.accent,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: c.accent, shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.32, shadowRadius: 6, elevation: 4,
    },
    avatarLetter: { fontSize: 16, fontWeight: typography.weights.bold, color: '#FFF', lineHeight: 20 },
    headerGreeting: { fontSize: typography.sizes.xs, color: c.textMuted },
    headerUsername: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, color: c.textPrimary },
    notifBtn: {
      width: 38, height: 38, borderRadius: 12,
      backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center',
    },
    notifDot: {
      position: 'absolute', top: 9, right: 9,
      width: 7, height: 7, borderRadius: 4,
      backgroundColor: c.accent, borderWidth: 1.5, borderColor: c.surface2,
    },

    // Search bar
    searchWrapper: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    divider: { height: 1, backgroundColor: c.border },
    scroll: { flex: 1 },

    // Empty state
    emptyContent: { padding: spacing.lg },
    sectionHeader: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
      marginBottom: spacing.md,
    },
    sectionTitle: {
      fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold,
      color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.7,
    },
    tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
    tagChip: {
      paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
      borderRadius: 10, borderWidth: 1,
    },
    tagText: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
    hintCard: {
      borderRadius: 16, borderWidth: 1,
      padding: spacing.xl, alignItems: 'center', gap: spacing.sm,
    },
    hintTitle: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold },
    hintSub: { fontSize: typography.sizes.sm, textAlign: 'center', lineHeight: typography.sizes.sm * 1.7 },

    // Loading
    loadingState: { paddingVertical: spacing.xxxxl, alignItems: 'center', gap: spacing.sm },
    loadingText: { fontSize: typography.sizes.sm },

    // No results
    noResults: { paddingVertical: spacing.xxxxl, alignItems: 'center', gap: spacing.sm },
    noResultsTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold },
    noResultsSub: { fontSize: typography.sizes.sm, textAlign: 'center' },

    // Results
    resultsSection: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
    postResult: {
      flexDirection: 'row', alignItems: 'flex-start',
      paddingVertical: spacing.md, borderBottomWidth: 1, gap: spacing.md,
    },
    postResultMeta: { flex: 1 },
    postResultHeader: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', marginBottom: 4,
    },
    postResultUser: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
    postResultTime: { fontSize: typography.sizes.xs },
    postResultText: { fontSize: typography.sizes.sm, lineHeight: typography.sizes.sm * 1.5 },
  });
}

export default SearchScreen;
