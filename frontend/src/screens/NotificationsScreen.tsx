import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { TabParamList } from '../types';
import { notificationApi, ApiNotification } from '../services/notificationApi';
import { useColors, Colors } from '../context/ThemeContext';
import { useSocket } from '../context/SocketContext';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { formatTimeAgo } from '../types';
import Avatar from '../components/atoms/Avatar';
import AppText from '../components/atoms/Text';

type NotifNavProp = BottomTabNavigationProp<TabParamList, 'Notifications'>;
interface NotificationsScreenProps { navigation: NotifNavProp; }

const NOTIF_ICONS: Record<string, string> = {
  COMMENT: 'chatbubble',
  REACTION: 'heart',
  MENTION: 'at',
  MESSAGE: 'mail',
};

const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ navigation }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { socket } = useSocket();

  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await notificationApi.getNotifications();
      setNotifications(data);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      void load();
      // Mark all as read after a short delay
      const timer = setTimeout(() => { void notificationApi.markAllRead(); }, 1500);
      return () => clearTimeout(timer);
    }, [load]),
  );

  // Real-time notifications
  useEffect(() => {
    if (!socket) return;
    const handler = (notif: ApiNotification) => {
      setNotifications((prev) => [notif, ...prev]);
    };
    socket.on('new-notification', handler);
    return () => { socket.off('new-notification', handler); };
  }, [socket]);

  const Header = (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.navigate('Feed')}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
      </TouchableOpacity>
      <AppText style={styles.title}>notifications</AppText>
      {notifications.some((n) => !n.isRead) ? (
        <TouchableOpacity
          onPress={() => {
            void notificationApi.markAllRead();
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
          }}
          activeOpacity={0.7}
        >
          <AppText style={[styles.markRead, { color: colors.accent }]}>mark all read</AppText>
        </TouchableOpacity>
      ) : (
        <View style={{ width: 36 }} />
      )}
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {Header}
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (notifications.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {Header}
        <View style={styles.center}>
          <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
          <AppText style={styles.emptyTitle}>all quiet here</AppText>
          <AppText style={styles.emptySub}>when people interact with your posts, you'll see it here</AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {Header}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const iconName = NOTIF_ICONS[item.type] ?? 'notifications';
          return (
            <View style={[styles.row, !item.isRead && styles.rowUnread]}>
              {item.fromUser ? (
                <Avatar username={item.fromUser.username} size={44} />
              ) : (
                <View style={[styles.iconCircle, { backgroundColor: `${colors.accent}18` }]}>
                  <Ionicons name={iconName as any} size={20} color={colors.accent} />
                </View>
              )}
              <View style={styles.rowContent}>
                <AppText style={styles.rowMessage}>{item.message}</AppText>
                <AppText style={styles.rowTime}>{formatTimeAgo(item.createdAt)}</AppText>
              </View>
              {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
};

function createStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: c.surface2,
      alignItems: 'center', justifyContent: 'center',
    },
    title: {
      fontSize: typography.sizes.xl, fontWeight: typography.weights.bold, color: c.textPrimary,
    },
    markRead: { fontSize: typography.sizes.sm, fontWeight: typography.weights.medium },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
    emptyTitle: {
      fontSize: typography.sizes.md, fontWeight: typography.weights.semibold,
      color: c.textPrimary, marginTop: spacing.md,
    },
    emptySub: { fontSize: typography.sizes.sm, color: c.textMuted, textAlign: 'center' },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    rowUnread: { backgroundColor: `${c.accent}08` },
    iconCircle: {
      width: 44, height: 44, borderRadius: 22,
      alignItems: 'center', justifyContent: 'center',
    },
    rowContent: { flex: 1 },
    rowMessage: { fontSize: typography.sizes.sm, color: c.textPrimary, marginBottom: 3 },
    rowTime: { fontSize: typography.sizes.xs, color: c.textMuted },
    unreadDot: { width: 8, height: 8, borderRadius: 4 },
  });
}

export default NotificationsScreen;
