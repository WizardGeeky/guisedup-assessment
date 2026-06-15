import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors, Colors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { searchApi, SearchResult } from '../services/searchApi';
import { formatTimeAgo } from '../types';
import SearchBar from '../components/molecules/SearchBar';
import Avatar from '../components/atoms/Avatar';
import AppText from '../components/atoms/Text';

const DEBOUNCE_MS = 500;

const SearchScreen: React.FC = () => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsSearching(false);
      return;
    }

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

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
  }, []);

  const isEmpty = query.trim().length === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.searchHeader}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          onClear={handleClear}
          placeholder="search posts..."
        />
      </View>

      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
      >
        {isEmpty ? (
          <View style={styles.emptyState}>
            <AppText style={styles.emptyIcon}>🔍</AppText>
            <AppText variant="body" style={styles.emptyText}>
              search for posts on any topic
            </AppText>
          </View>
        ) : isSearching ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : results.length === 0 ? (
          <View style={styles.emptyState}>
            <AppText style={styles.emptyIcon}>🔍</AppText>
            <AppText variant="caption" style={styles.noResultsText}>
              no results for "{query}"
            </AppText>
          </View>
        ) : (
          <View style={styles.section}>
            <AppText variant="label" style={styles.sectionTitle}>
              posts
            </AppText>
            {results.map((result) => (
              <TouchableOpacity
                key={result.post.id}
                style={styles.postResult}
                activeOpacity={0.7}
              >
                <Avatar username={result.post.author.username} size={36} />
                <View style={styles.postResultMeta}>
                  <View style={styles.postResultHeader}>
                    <AppText variant="label" style={styles.postResultUser}>
                      {result.post.author.username}
                    </AppText>
                    <AppText variant="caption" style={styles.postResultTime}>
                      {formatTimeAgo(result.post.createdAt)}
                    </AppText>
                  </View>
                  <AppText variant="caption" style={styles.postResultText} numberOfLines={2}>
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
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    searchHeader: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    scroll: {
      flex: 1,
    },
    section: {
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.xl,
    },
    sectionTitle: {
      color: c.textSecondary,
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: spacing.md,
    },
    postResult: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      gap: spacing.md,
    },
    postResultMeta: {
      flex: 1,
    },
    postResultHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 3,
    },
    postResultUser: {
      color: c.textPrimary,
      fontSize: typography.sizes.sm,
    },
    postResultTime: {
      color: c.textMuted,
      fontSize: typography.sizes.xs,
    },
    postResultText: {
      color: c.textSecondary,
      lineHeight: typography.sizes.sm * 1.5,
    },
    emptyState: {
      paddingVertical: spacing.xxxxl,
      alignItems: 'center',
    },
    emptyIcon: {
      fontSize: 40,
      marginBottom: spacing.md,
      textAlign: 'center',
    },
    emptyText: {
      color: c.textMuted,
      textAlign: 'center',
    },
    noResultsText: {
      color: c.textMuted,
      textAlign: 'center',
    },
    loadingState: {
      paddingVertical: spacing.xxxxl,
      alignItems: 'center',
    },
  });
}

export default SearchScreen;
