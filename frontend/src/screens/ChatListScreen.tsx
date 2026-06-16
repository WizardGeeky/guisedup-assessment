import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ChatStackParamList } from '../types';
import { chatApi, ConversationPreview, UserSearchResult } from '../services/chatApi';
import { useColors, Colors } from '../context/ThemeContext';
import { useSocket } from '../context/SocketContext';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { formatTimeAgo } from '../types';
import Avatar from '../components/atoms/Avatar';
import AppText from '../components/atoms/Text';

type ChatListNav = NativeStackNavigationProp<ChatStackParamList, 'ChatList'>;
interface ChatListScreenProps { navigation: ChatListNav; }

const ChatListScreen: React.FC<ChatListScreenProps> = ({ navigation }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { socket } = useSocket();

  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await chatApi.getConversations();
      setConversations(data);
    } catch { /* silent */ } finally { setIsLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void loadConversations(); }, [loadConversations]));

  useEffect(() => {
    if (!socket) return;
    const handler = () => void loadConversations();
    socket.on('new-message', handler);
    return () => { socket.off('new-message', handler); };
  }, [socket, loadConversations]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchText.trim()) {
      setSearchResults([]);
      setIsSearchMode(false);
      return;
    }
    setIsSearchMode(true);
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await chatApi.searchUsers(searchText);
        setSearchResults(results);
      } catch { setSearchResults([]); } finally { setIsSearching(false); }
    }, 350);
  }, [searchText]);

  const clearSearch = useCallback(() => {
    setSearchText(''); setSearchResults([]); setIsSearchMode(false); Keyboard.dismiss();
  }, []);

  const openChat = useCallback((userId: string, username: string) => {
    clearSearch();
    navigation.navigate('ChatRoom', { userId, username });
  }, [navigation, clearSearch]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.getParent()?.navigate('Feed')}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={21} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <AppText style={styles.title}>messages</AppText>
          {!isSearchMode && conversations.length > 0 && (
            <AppText style={styles.titleSub}>{conversations.length} conversations</AppText>
          )}
        </View>

        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.getParent()?.navigate('Notifications')}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={21} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* ── Search pill ── */}
      <View style={styles.searchRow}>
        <View style={[styles.searchPill, isSearchMode && { backgroundColor: `${colors.accent}10` }]}>
          <Ionicons
            name="search"
            size={17}
            color={isSearchMode ? colors.accent : colors.textMuted}
          />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="find someone to chat with..."
            placeholderTextColor={colors.textMuted}
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={clearSearch} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Search results ── */}
      {isSearchMode ? (
        <View style={styles.flex}>
          {isSearching ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.accent} />
              <AppText style={styles.loadingText}>searching people...</AppText>
            </View>
          ) : searchResults.length === 0 ? (
            <View style={styles.center}>
              <View style={[styles.emptyCircle, { backgroundColor: `${colors.accent}14` }]}>
                <Ionicons name="person-outline" size={38} color={colors.accent} />
              </View>
              <AppText style={styles.emptyTitle}>no one found</AppText>
              <AppText style={styles.emptySub}>try searching by exact username</AppText>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              ListHeaderComponent={
                <AppText style={styles.sectionLabel}>
                  {searchResults.length} {searchResults.length === 1 ? 'person' : 'people'} found
                </AppText>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.userCard}
                  onPress={() => openChat(item.id, item.username)}
                  activeOpacity={0.78}
                >
                  <Avatar username={item.username} size={54} />
                  <View style={styles.cardInfo}>
                    <AppText style={styles.cardName}>{item.username}</AppText>
                    <AppText style={styles.cardSub} numberOfLines={1}>
                      {item.bio || 'tap to start a conversation'}
                    </AppText>
                  </View>
                  <View style={[styles.sendBtn, { backgroundColor: colors.accent }]}>
                    <Ionicons name="send" size={15} color="#FFF" style={{ marginLeft: 2 }} />
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      ) : (

        /* ── Conversation list ── */
        <View style={styles.flex}>
          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : conversations.length === 0 ? (
            <View style={styles.center}>
              <View style={[styles.emptyCircle, { backgroundColor: `${colors.accent}14` }]}>
                <Ionicons name="chatbubbles-outline" size={42} color={colors.accent} />
              </View>
              <AppText style={styles.emptyTitle}>no messages yet</AppText>
              <AppText style={styles.emptySub}>
                search for people above{'\n'}and send your first message
              </AppText>
            </View>
          ) : (
            <FlatList
              data={conversations}
              keyExtractor={(item) => item.userId}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              ListHeaderComponent={<AppText style={styles.sectionLabel}>recent</AppText>}
              renderItem={({ item }) => {
                const hasUnread = item.unreadCount > 0;
                return (
                  <TouchableOpacity
                    style={[styles.convoCard, hasUnread && { backgroundColor: `${colors.accent}07` }]}
                    onPress={() => openChat(item.userId, item.username)}
                    activeOpacity={0.78}
                  >
                    <View style={styles.avatarWrap}>
                      <Avatar username={item.username} size={52} />
                      {hasUnread && (
                        <View style={[styles.onlineDot, { backgroundColor: colors.accent }]} />
                      )}
                    </View>

                    <View style={styles.cardInfo}>
                      <View style={styles.convoTop}>
                        <AppText style={[styles.cardName, hasUnread && styles.nameBold]}>
                          {item.username}
                        </AppText>
                        <AppText style={[styles.convoTime, hasUnread && { color: colors.accent }]}>
                          {formatTimeAgo(item.lastMessageAt)}
                        </AppText>
                      </View>
                      <View style={styles.convoBottom}>
                        <AppText
                          style={[styles.convoPreview, hasUnread && styles.previewBold]}
                          numberOfLines={1}
                        >
                          {item.lastMessage}
                        </AppText>
                        {hasUnread && (
                          <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                            <AppText style={styles.badgeText}>
                              {item.unreadCount > 99 ? '99+' : item.unreadCount}
                            </AppText>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

function createStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    listContent: { paddingBottom: spacing.xl },

    // Header
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    },
    headerBtn: {
      width: 38, height: 38, borderRadius: 12,
      backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center',
    },
    headerCenter: { alignItems: 'center' },
    title: { fontSize: 20, fontWeight: typography.weights.bold, color: c.textPrimary },
    titleSub: { fontSize: 11, color: c.textMuted, marginTop: 1 },

    // Search
    searchRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    searchPill: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      backgroundColor: c.surface2, borderRadius: 28,
      paddingHorizontal: 16, paddingVertical: 11,
    },
    searchInput: { flex: 1, fontSize: 14, padding: 0 },

    // Section label
    sectionLabel: {
      fontSize: 11, fontWeight: '600', color: c.textMuted,
      textTransform: 'uppercase', letterSpacing: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md, paddingBottom: spacing.sm,
    },

    // Center / empty
    center: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      gap: spacing.sm, paddingHorizontal: spacing.xl,
    },
    emptyCircle: {
      width: 84, height: 84, borderRadius: 42,
      alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
    },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: c.textPrimary },
    emptySub: { fontSize: 13, color: c.textMuted, textAlign: 'center', lineHeight: 20 },
    loadingText: { fontSize: 13, color: c.textMuted, marginTop: spacing.xs },

    // User search card
    userCard: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      paddingHorizontal: spacing.lg, paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    },
    cardInfo: { flex: 1 },
    cardName: { fontSize: 15, fontWeight: '600', color: c.textPrimary, marginBottom: 3 },
    cardSub: { fontSize: 13, color: c.textMuted },
    sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

    // Conversation card
    convoCard: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      paddingHorizontal: spacing.lg, paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    },
    avatarWrap: { position: 'relative' },
    onlineDot: {
      position: 'absolute', bottom: 1, right: 1,
      width: 13, height: 13, borderRadius: 7, borderWidth: 2.5, borderColor: c.background,
    },
    convoTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    nameBold: { fontWeight: '700' },
    convoTime: { fontSize: 11, color: c.textMuted },
    convoBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    convoPreview: { fontSize: 13, color: c.textSecondary, flex: 1, marginRight: spacing.sm },
    previewBold: { color: c.textPrimary, fontWeight: '500' },
    badge: {
      minWidth: 20, height: 20, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
    },
    badgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  });
}

export default ChatListScreen;
