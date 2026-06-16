import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { commentApi, ApiComment } from '../../services/commentApi';
import { useColors, Colors } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { formatTimeAgo } from '../../types';
import Avatar from '../atoms/Avatar';
import AppText from '../atoms/Text';

interface CommentsSheetProps {
  postId: string;
  visible: boolean;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}

const CommentsSheet: React.FC<CommentsSheetProps> = ({ postId, visible, onClose, onCountChange }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();
  const { socket, joinPost, leavePost } = useSocket();

  const [comments, setComments] = useState<ApiComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const loadComments = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await commentApi.getComments(postId);
      setComments(data);
      onCountChange?.(data.length);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [postId, onCountChange]);

  useEffect(() => {
    if (!visible) return;
    void loadComments();
    joinPost(postId);
    return () => leavePost(postId);
  }, [visible, postId, loadComments, joinPost, leavePost]);

  // Real-time new comment from socket
  useEffect(() => {
    if (!socket) return;
    const handler = (comment: ApiComment) => {
      setComments((prev) => {
        if (prev.find((c) => c.id === comment.id)) return prev;
        const updated = [...prev, comment];
        onCountChange?.(updated.length);
        return updated;
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    };
    socket.on('new-comment', handler);
    return () => { socket.off('new-comment', handler); };
  }, [socket, onCountChange]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    setIsSending(true);
    setText('');
    try {
      const comment = await commentApi.addComment(postId, trimmed);
      setComments((prev) => {
        if (prev.find((c) => c.id === comment.id)) return prev;
        const updated = [...prev, comment];
        onCountChange?.(updated.length);
        return updated;
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setText(trimmed);
    } finally {
      setIsSending(false);
    }
  }, [text, postId, isSending, onCountChange]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.sheet}
      >
        {/* Handle + header */}
        <View style={styles.handleBar} />
        <View style={styles.header}>
          <AppText style={styles.title}>comments ({comments.length})</AppText>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Comment list */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={comments}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={36} color={colors.textMuted} />
                <AppText style={styles.emptyText}>no comments yet — be the first</AppText>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.commentRow}>
                <Avatar username={item.author.username} size={32} />
                <View style={styles.commentBody}>
                  <View style={styles.commentHeader}>
                    <AppText style={styles.commentUser}>{item.author.username}</AppText>
                    <AppText style={styles.commentTime}>{formatTimeAgo(item.createdAt)}</AppText>
                  </View>
                  <AppText style={styles.commentText}>{item.text}</AppText>
                </View>
              </View>
            )}
          />
        )}

        {/* Input bar */}
        <View style={[styles.inputBar, { borderTopColor: colors.border }]}>
          <Avatar username={user?.username ?? '?'} size={32} />
          <TextInput
            style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surface2 }]}
            placeholder="add a comment..."
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!text.trim() || isSending}
            activeOpacity={0.7}
            style={[styles.sendBtn, { backgroundColor: colors.accent, opacity: text.trim() ? 1 : 0.4 }]}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="send" size={16} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

function createStyles(c: Colors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      backgroundColor: c.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '75%',
      minHeight: '50%',
    },
    handleBar: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: c.border,
      alignSelf: 'center', marginTop: spacing.sm,
    },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    title: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold,
      color: c.textPrimary,
    },
    closeBtn: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: c.surface2,
      alignItems: 'center', justifyContent: 'center',
    },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    listContent: { padding: spacing.lg, paddingBottom: spacing.md },
    emptyContainer: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxxxl },
    emptyText: { color: c.textMuted, fontSize: typography.sizes.sm },
    commentRow: {
      flexDirection: 'row', gap: spacing.md,
      marginBottom: spacing.lg, alignItems: 'flex-start',
    },
    commentBody: { flex: 1 },
    commentHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 3 },
    commentUser: {
      fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: c.textPrimary,
    },
    commentTime: { fontSize: typography.sizes.xs, color: c.textMuted },
    commentText: { fontSize: typography.sizes.sm, color: c.textPrimary, lineHeight: typography.sizes.sm * 1.5 },
    inputBar: {
      flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
      padding: spacing.md, borderTopWidth: 1,
    },
    input: {
      flex: 1, borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      fontSize: typography.sizes.sm, maxHeight: 100,
    },
    sendBtn: {
      width: 36, height: 36, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
    },
  });
}

export default CommentsSheet;
