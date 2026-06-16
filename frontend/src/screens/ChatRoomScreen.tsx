import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ChatStackParamList } from '../types';
import { chatApi, ApiMessage } from '../services/chatApi';
import { useColors, Colors } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { formatTimeAgo } from '../types';
import Avatar from '../components/atoms/Avatar';
import AppText from '../components/atoms/Text';

type ChatRoomNav = NativeStackNavigationProp<ChatStackParamList, 'ChatRoom'>;
type ChatRoomRoute = RouteProp<ChatStackParamList, 'ChatRoom'>;

interface ChatRoomScreenProps {
  navigation: ChatRoomNav;
  route: ChatRoomRoute;
}

const ChatRoomScreen: React.FC<ChatRoomScreenProps> = ({ navigation, route }) => {
  const { userId: otherUserId, username } = route.params;
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();
  const { socket } = useSocket();

  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await chatApi.getConversation(otherUserId);
      setMessages(data);
    } catch { /* silent */ } finally { setIsLoading(false); }
  }, [otherUserId]);

  useEffect(() => { void loadMessages(); }, [loadMessages]);

  useEffect(() => {
    if (!socket) return;
    const handler = (msg: ApiMessage) => {
      if (
        (msg.fromUserId === otherUserId && msg.toUserId === user?.id) ||
        (msg.fromUserId === user?.id && msg.toUserId === otherUserId)
      ) {
        setMessages((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    };
    socket.on('new-message', handler);
    return () => { socket.off('new-message', handler); };
  }, [socket, otherUserId, user?.id]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    setIsSending(true);
    setText('');
    try {
      const msg = await chatApi.sendMessage(otherUserId, trimmed);
      setMessages((prev) => {
        if (prev.find((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch { setText(trimmed); } finally { setIsSending(false); }
  }, [text, otherUserId, isSending]);

  const myId = user?.id;
  const canSend = text.trim().length > 0 && !isSending;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={21} color={colors.textPrimary} />
        </TouchableOpacity>

        {/* Center: avatar + name stacked */}
        <TouchableOpacity style={styles.headerUser} activeOpacity={0.8}>
          <Avatar username={username} size={38} />
          <View style={styles.headerUserText}>
            <AppText style={styles.headerName}>{username}</AppText>
            <AppText style={styles.headerStatus}>tap for info</AppText>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.getParent()?.navigate('Notifications')}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={21} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* ── Messages ── */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={messages.length === 0 ? styles.emptyContent : styles.messageList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.emptyConvo}>
                <View style={[styles.emptyAvatarRing, { borderColor: `${colors.accent}30` }]}>
                  <Avatar username={username} size={78} />
                </View>
                <AppText style={styles.emptyName}>{username}</AppText>
                <View style={[styles.emptyHintRow, { backgroundColor: `${colors.accent}12` }]}>
                  <AppText style={[styles.emptyHint, { color: colors.accent }]}>say hello 👋</AppText>
                </View>
                <AppText style={styles.emptySub}>this is the start of your conversation</AppText>
              </View>
            }
            renderItem={({ item, index }) => {
              const isMine = item.fromUserId === myId;
              const prevItem = index > 0 ? messages[index - 1] : null;
              const showAvatar = !isMine && (!prevItem || prevItem.fromUserId !== item.fromUserId);
              return (
                <View style={[styles.bubbleRow, isMine ? styles.rowMine : styles.rowOther]}>
                  {!isMine && (
                    <View style={styles.bubbleAvatar}>
                      {showAvatar ? <Avatar username={username} size={28} /> : <View style={{ width: 28 }} />}
                    </View>
                  )}
                  <View style={[
                    styles.bubble,
                    isMine
                      ? { backgroundColor: colors.accent }
                      : { backgroundColor: colors.surface2 },
                  ]}>
                    <AppText style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
                      {item.text}
                    </AppText>
                    <AppText style={[styles.bubbleTime, isMine ? styles.bubbleTimeMine : styles.bubbleTimeOther]}>
                      {formatTimeAgo(item.createdAt)}
                    </AppText>
                  </View>
                </View>
              );
            }}
          />

          {/* ── Input bar ── */}
          <View style={[styles.inputBar, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
            <View style={[styles.inputWrap, { backgroundColor: colors.surface2 }]}>
              <TextInput
                style={[styles.input, { color: colors.textPrimary }]}
                placeholder="type a message..."
                placeholderTextColor={colors.textMuted}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={2000}
              />
            </View>
            <TouchableOpacity
              onPress={handleSend}
              disabled={!canSend}
              activeOpacity={0.8}
              style={[styles.sendBtn, { backgroundColor: canSend ? colors.accent : colors.surface2 }]}
            >
              {isSending ? (
                <ActivityIndicator size="small" color={canSend ? '#FFF' : colors.textMuted} />
              ) : (
                <Ionicons
                  name="send"
                  size={17}
                  color={canSend ? '#FFF' : colors.textMuted}
                  style={{ marginLeft: 2 }}
                />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
};

function createStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },

    // Header
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: spacing.lg, paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
      gap: spacing.sm,
    },
    iconBtn: {
      width: 38, height: 38, borderRadius: 12,
      backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center',
    },
    headerUser: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      justifyContent: 'center',
    },
    headerUserText: { alignItems: 'flex-start' },
    headerName: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
    headerStatus: { fontSize: 11, color: c.textMuted, marginTop: 1 },

    // Center / loading
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    // Empty conversation state
    emptyContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyConvo: { alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.xl },
    emptyAvatarRing: {
      padding: 6, borderRadius: 56, borderWidth: 2, marginBottom: spacing.xs,
    },
    emptyName: { fontSize: 20, fontWeight: '700', color: c.textPrimary },
    emptyHintRow: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
    emptyHint: { fontSize: 15, fontWeight: '600' },
    emptySub: { fontSize: 13, color: c.textMuted, textAlign: 'center' },

    // Messages
    messageList: { paddingHorizontal: spacing.sm, paddingVertical: spacing.md, paddingBottom: spacing.lg },
    bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 6 },
    rowMine: { justifyContent: 'flex-end', paddingLeft: 60 },
    rowOther: { justifyContent: 'flex-start', paddingRight: 60 },
    bubbleAvatar: { marginRight: 6, marginBottom: 2 },
    bubble: {
      borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8,
      maxWidth: '85%',
    },
    bubbleText: {
      fontSize: typography.sizes.sm, color: c.textPrimary,
      lineHeight: (typography.sizes.sm ?? 14) * 1.45,
    },
    bubbleTextMine: { color: '#FFF' },
    bubbleTime: { fontSize: 10, marginTop: 3 },
    bubbleTimeMine: { color: 'rgba(255,255,255,0.65)', textAlign: 'right' },
    bubbleTimeOther: { color: c.textMuted },

    // Input
    inputBar: {
      flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    inputWrap: {
      flex: 1, borderRadius: 22,
      paddingHorizontal: 14, paddingVertical: 9,
      minHeight: 44, justifyContent: 'center',
    },
    input: { fontSize: 14, maxHeight: 120, padding: 0 },
    sendBtn: {
      width: 44, height: 44, borderRadius: 22,
      alignItems: 'center', justifyContent: 'center',
    },
  });
}

export default ChatRoomScreen;
