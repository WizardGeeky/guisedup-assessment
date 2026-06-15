import React, { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ProfileStackParamList } from '../types';
import { useColors, Colors } from '../context/ThemeContext';
import { useTheme } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { getAvatarColor } from '../types';
import { postApi } from '../services/postApi';
import { ApiPost } from '../services/feedApi';
import { useAuth } from '../context/AuthContext';
import AppText from '../components/atoms/Text';
import Button from '../components/atoms/Button';

type ProfileNav = NativeStackNavigationProp<ProfileStackParamList, 'ProfileHome'>;

const THUMB_COLORS = ['#E91E63', '#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#00BCD4'];

const ProfileScreen: React.FC = () => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isDark, toggleTheme } = useTheme();
  const navigation = useNavigation<ProfileNav>();
  const { user } = useAuth();

  const [userPosts, setUserPosts] = useState<ApiPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPosts = async () => {
      try {
        const posts = await postApi.getUserPosts();
        setUserPosts(posts);
      } catch { /* silent */ }
      finally { setIsLoading(false); }
    };
    void loadPosts();
  }, []);

  if (!user) return null;

  const avatarColor = getAvatarColor(user.username);
  const initial = user.username.charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Header row */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.getParent()?.navigate('Feed')}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <AppText variant="h3" style={styles.headerTitle}>profile</AppText>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            style={styles.settingsBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Avatar + info */}
        <View style={styles.profileBlock}>
          <View style={[styles.avatarCircle, { backgroundColor: avatarColor }]}>
            <AppText style={styles.avatarInitial}>{initial}</AppText>
          </View>
          <AppText variant="h3" style={styles.displayName}>{user.username}</AppText>
          <AppText variant="caption" style={styles.handle}>@{user.username}</AppText>
          <AppText variant="caption" style={styles.email}>{user.email}</AppText>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <AppText variant="h3" style={styles.statValue}>{userPosts.length}</AppText>
              <AppText variant="caption" style={styles.statLabel}>posts</AppText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <AppText variant="h3" style={styles.statValue}>
                {userPosts.reduce((s, p) => s + (p.viewCount ?? 0), 0)}
              </AppText>
              <AppText variant="caption" style={styles.statLabel}>views</AppText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <AppText variant="h3" style={styles.statValue}>
                {userPosts.reduce((s, p) => s + (p._count?.interactions ?? 0), 0)}
              </AppText>
              <AppText variant="caption" style={styles.statLabel}>reactions</AppText>
            </View>
          </View>

          <Button title="edit profile" onPress={() => navigation.navigate('EditProfile')} variant="secondary" style={styles.editBtn} />
        </View>

        <View style={styles.divider} />

        {/* Appearance section */}
        <View style={styles.section}>
          <AppText variant="label" style={styles.sectionLabel}>appearance</AppText>
          <View style={styles.themeRow}>
            {/* Light option */}
            <TouchableOpacity
              style={[styles.themeCard, !isDark && styles.themeCardActive]}
              onPress={() => { if (isDark) toggleTheme(); }}
              activeOpacity={0.75}
            >
              <View style={[styles.themePreview, { backgroundColor: '#FAF9F6' }]}>
                <View style={[styles.tpLine, { backgroundColor: '#E8E5DE', width: '60%' }]} />
                <View style={[styles.tpLine, { backgroundColor: '#E8E5DE', width: '80%' }]} />
                <View style={[styles.tpDot, { backgroundColor: '#FF5722' }]} />
              </View>
              <View style={styles.themeCardFooter}>
                <Ionicons name="sunny-outline" size={14} color={!isDark ? colors.accent : colors.textMuted} />
                <AppText variant="caption" style={[styles.themeLabel, !isDark && styles.themeLabelActive]}>
                  light
                </AppText>
              </View>
            </TouchableOpacity>

            {/* Dark option */}
            <TouchableOpacity
              style={[styles.themeCard, isDark && styles.themeCardActive]}
              onPress={() => { if (!isDark) toggleTheme(); }}
              activeOpacity={0.75}
            >
              <View style={[styles.themePreview, { backgroundColor: '#0F0F0F' }]}>
                <View style={[styles.tpLine, { backgroundColor: '#38383A', width: '60%' }]} />
                <View style={[styles.tpLine, { backgroundColor: '#38383A', width: '80%' }]} />
                <View style={[styles.tpDot, { backgroundColor: '#FF5722' }]} />
              </View>
              <View style={styles.themeCardFooter}>
                <Ionicons name="moon-outline" size={14} color={isDark ? colors.accent : colors.textMuted} />
                <AppText variant="caption" style={[styles.themeLabel, isDark && styles.themeLabelActive]}>
                  dark
                </AppText>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Posts grid */}
        <View style={styles.section}>
          <AppText variant="label" style={styles.sectionLabel}>posts</AppText>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : userPosts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="create-outline" size={32} color={colors.textMuted} />
              <AppText variant="caption" style={styles.emptyText}>no posts yet — share something real</AppText>
            </View>
          ) : (
            <View style={styles.grid}>
              {userPosts.map((post, index) => (
                <TouchableOpacity
                  key={post.id}
                  style={[styles.gridThumb, { backgroundColor: THUMB_COLORS[index % THUMB_COLORS.length] }]}
                  activeOpacity={0.8}
                >
                  <AppText style={styles.gridThumbText} numberOfLines={3}>{post.text}</AppText>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

function createStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    scrollContent: { paddingBottom: spacing.xxxxl },
    headerRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md,
    },
    backBtn: {
      width: 38, height: 38, borderRadius: 12, backgroundColor: c.surface2,
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { color: c.textPrimary, fontWeight: typography.weights.bold },
    settingsBtn: {
      width: 38, height: 38, borderRadius: 12, backgroundColor: c.surface2,
      alignItems: 'center', justifyContent: 'center',
    },
    profileBlock: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
    avatarCircle: {
      width: 96, height: 96, borderRadius: 48,
      alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
    },
    avatarInitial: {
      fontSize: 42, fontWeight: typography.weights.bold, color: '#FFFFFF', lineHeight: 50,
    },
    displayName: { color: c.textPrimary, fontWeight: typography.weights.bold, marginBottom: 4 },
    handle: { color: c.textMuted, fontSize: typography.sizes.sm, marginBottom: 2 },
    email: { color: c.textMuted, fontSize: typography.sizes.xs, marginBottom: spacing.xl },
    statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl },
    statItem: { alignItems: 'center', paddingHorizontal: spacing.xl },
    statValue: { color: c.textPrimary, fontWeight: typography.weights.bold, fontSize: typography.sizes.xl },
    statLabel: { color: c.textMuted, fontSize: typography.sizes.xs, marginTop: 2 },
    statDivider: { width: 1, height: 32, backgroundColor: c.border },
    editBtn: { width: '100%' },
    divider: { height: 1, backgroundColor: c.border, marginHorizontal: spacing.lg, marginBottom: spacing.lg },
    section: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
    sectionLabel: {
      color: c.textSecondary, fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold, textTransform: 'uppercase',
      letterSpacing: 0.8, marginBottom: spacing.md,
    },
    // Theme cards
    themeRow: { flexDirection: 'row', gap: spacing.md },
    themeCard: {
      flex: 1, borderRadius: 14, borderWidth: 2, borderColor: c.border,
      overflow: 'hidden', backgroundColor: c.surface,
    },
    themeCardActive: { borderColor: c.accent },
    themePreview: { height: 70, padding: spacing.sm, justifyContent: 'flex-end', gap: 4 },
    tpLine: { height: 4, borderRadius: 2 },
    tpDot: { width: 12, height: 12, borderRadius: 6, alignSelf: 'flex-end' },
    themeCardFooter: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      padding: spacing.sm, paddingTop: spacing.xs,
    },
    themeLabel: { color: c.textMuted, fontSize: typography.sizes.sm },
    themeLabelActive: { color: c.accent, fontWeight: typography.weights.semibold },
    // Grid
    loadingContainer: { paddingVertical: spacing.xxxxl, alignItems: 'center' },
    emptyContainer: { paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.sm },
    emptyText: { color: c.textMuted, textAlign: 'center' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    gridThumb: {
      width: '31.5%', aspectRatio: 1, borderRadius: 8,
      overflow: 'hidden', padding: spacing.xs, justifyContent: 'flex-end',
    },
    gridThumbText: { color: 'rgba(255,255,255,0.9)', fontSize: 8, lineHeight: 11 },
  });
}

export default ProfileScreen;
