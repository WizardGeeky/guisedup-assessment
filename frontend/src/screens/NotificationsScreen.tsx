import React, { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { TabParamList } from '../types';
import { useColors, Colors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { postApi } from '../services/postApi';
import { interactionApi, InteractionCounts } from '../services/interactionApi';
import { ApiPost } from '../services/feedApi';
import { formatTimeAgo } from '../types';
import Avatar from '../components/atoms/Avatar';
import AppText from '../components/atoms/Text';
import EmptyState from '../components/molecules/EmptyState';

type NotifNavProp = BottomTabNavigationProp<TabParamList, 'Notifications'>;

interface PostActivity {
  post: ApiPost;
  counts: InteractionCounts;
}

interface NotificationsScreenProps { navigation: NotifNavProp; }

const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ navigation }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [activities, setActivities] = useState<PostActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const posts = await postApi.getUserPosts();
        const withCounts = await Promise.all(
          posts.map(async (post) => {
            try {
              const counts = await interactionApi.getPostInteractions(post.id);
              return { post, counts };
            } catch {
              return null;
            }
          }),
        );
        setActivities(withCounts.filter((a): a is PostActivity => a !== null));
      } catch {
        setActivities([]);
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  const Header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.navigate('Feed')} activeOpacity={0.7} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
      </TouchableOpacity>
      <AppText variant="h3" style={styles.screenTitle}>activity</AppText>
      <View style={styles.backBtn} />
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {Header}
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const hasActivity = activities.some((a) => a.counts.totalCount > 0);

  if (!hasActivity) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {Header}
        <EmptyState
          icon="🔔"
          title="all quiet here"
          subtitle="when people interact with your posts, you'll see it here"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {Header}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {activities
          .filter((a) => a.counts.totalCount > 0)
          .map(({ post, counts }) => (
            <View key={post.id} style={styles.activityRow}>
              <Avatar username={post.author.username} size={44} />
              <View style={styles.activityContent}>
                <AppText variant="body" style={styles.activityText} numberOfLines={2}>
                  "{post.text}"
                </AppText>
                <View style={styles.countsRow}>
                  {counts.reactionCount > 0 && (
                    <AppText variant="caption" style={styles.countItem}>
                      ❤️ {counts.reactionCount}
                    </AppText>
                  )}
                  {counts.replyCount > 0 && (
                    <AppText variant="caption" style={styles.countItem}>
                      💬 {counts.replyCount}
                    </AppText>
                  )}
                  {counts.viewCount > 0 && (
                    <AppText variant="caption" style={styles.countItem}>
                      👁 {counts.viewCount}
                    </AppText>
                  )}
                </View>
                <AppText variant="caption" style={styles.activityTime}>
                  {formatTimeAgo(post.createdAt)}
                </AppText>
              </View>
            </View>
          ))}
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: c.surface2,
      alignItems: 'center', justifyContent: 'center',
    },
    screenTitle: {
      color: c.textPrimary,
      fontWeight: typography.weights.bold,
    },
    scrollContent: {
      paddingBottom: spacing.xxxxl,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    activityRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      gap: spacing.md,
    },
    activityContent: {
      flex: 1,
    },
    activityText: {
      color: c.textPrimary,
      fontSize: typography.sizes.sm,
      lineHeight: typography.sizes.sm * 1.5,
      fontStyle: 'italic',
      marginBottom: spacing.xs,
    },
    countsRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: 3,
    },
    countItem: {
      color: c.textSecondary,
      fontSize: typography.sizes.sm,
    },
    activityTime: {
      color: c.textMuted,
      fontSize: typography.sizes.xs,
    },
  });
}

export default NotificationsScreen;
