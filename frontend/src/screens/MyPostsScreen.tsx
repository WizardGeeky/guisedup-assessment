import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { TabParamList } from '../types';
import { postApi } from '../services/postApi';
import { ApiPost } from '../services/feedApi';
import { useColors, Colors } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { formatTimeAgo } from '../types';
import { webInputReset } from '../utils/webStyle';
import Avatar from '../components/atoms/Avatar';
import AppText from '../components/atoms/Text';

type MyPostsNavProp = BottomTabNavigationProp<TabParamList, 'MyPosts'>;
interface Props { navigation: MyPostsNavProp; }

const MAX_CHARS = 2000;

const MyPostsScreen: React.FC<Props> = ({ navigation }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();

  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Edit modal state
  const [editingPost, setEditingPost] = useState<ApiPost | null>(null);
  const [editText, setEditText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const loadPosts = useCallback(async () => {
    try {
      const data = await postApi.getUserPosts();
      setPosts(data);
    } catch {
      /* silent */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        setIsLoading(true);
        void loadPosts().finally(() => setIsLoading(false));
      } else {
        setIsRefreshing(true);
        void loadPosts().finally(() => setIsRefreshing(false));
      }
    }, [loadPosts])
  );

  const openEdit = useCallback((post: ApiPost) => {
    setEditingPost(post);
    setEditText(post.text);
  }, []);

  const closeEdit = useCallback(() => {
    setEditingPost(null);
    setEditText('');
  }, []);

  const handleSave = useCallback(async () => {
    if (!editingPost || !editText.trim()) return;
    setIsSaving(true);
    try {
      const updated = await postApi.updatePost(editingPost.id, editText.trim());
      setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      closeEdit();
    } catch {
      Alert.alert('Error', 'Failed to update post. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [editingPost, editText, closeEdit]);

  const handleDelete = useCallback((post: ApiPost) => {
    Alert.alert(
      'Delete post',
      'This will permanently remove the post. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(post.id);
            try {
              await postApi.deletePost(post.id);
              setPosts((prev) => prev.filter((p) => p.id !== post.id));
            } catch {
              Alert.alert('Error', 'Failed to delete post. Please try again.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  }, []);

  const charsLeft = MAX_CHARS - editText.length;
  const isOverLimit = charsLeft < 0;

  const renderItem = useCallback(
    ({ item }: { item: ApiPost }) => {
      const isDeleting = deletingId === item.id;
      return (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Card header */}
          <View style={styles.cardHeader}>
            <Avatar username={item.author.username} size={36} />
            <View style={styles.cardMeta}>
              <AppText style={[styles.cardUsername, { color: colors.textPrimary }]}>
                {item.author.username}
              </AppText>
              <AppText style={[styles.cardTime, { color: colors.textMuted }]}>
                {formatTimeAgo(item.createdAt)}
              </AppText>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: `${colors.accent}12` }]}
                onPress={() => openEdit(item)}
                activeOpacity={0.7}
                disabled={isDeleting}
              >
                <Ionicons name="pencil-outline" size={15} color={colors.accent} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: `${colors.error}12` }]}
                onPress={() => handleDelete(item)}
                activeOpacity={0.7}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <Ionicons name="trash-outline" size={15} color={colors.error} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Post text */}
          <AppText style={[styles.cardText, { color: colors.textPrimary }]} numberOfLines={5}>
            {item.text}
          </AppText>

          {/* Footer stats */}
          <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
            <View style={styles.stat}>
              <Ionicons name="heart-outline" size={14} color={colors.textMuted} />
              <AppText style={[styles.statText, { color: colors.textMuted }]}>
                {item._count?.interactions ?? 0}
              </AppText>
            </View>
            <View style={styles.stat}>
              <Ionicons name="eye-outline" size={14} color={colors.textMuted} />
              <AppText style={[styles.statText, { color: colors.textMuted }]}>
                {item.viewCount ?? 0}
              </AppText>
            </View>
            <View style={[styles.authBadge, { backgroundColor: `${colors.accent}14` }]}>
              <AppText style={[styles.authText, { color: colors.accent }]}>
                {Math.round(item.authenticityScore * 100)}% authentic
              </AppText>
            </View>
          </View>
        </View>
      );
    },
    [colors, deletingId, openEdit, handleDelete]
  );

  const initials = user?.username ? user.username[0].toUpperCase() : 'G';
  const displayName = user?.username ? `@${user.username}` : '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.navigate('Feed')}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={[styles.avatarCircle, { backgroundColor: colors.accent }]}>
            <AppText style={styles.avatarLetter}>{initials}</AppText>
          </View>
          <View>
            <AppText style={[styles.headerLabel, { color: colors.textMuted }]}>my posts</AppText>
            <AppText style={[styles.headerUsername, { color: colors.textPrimary }]}>{displayName}</AppText>
          </View>
        </View>
        <View style={[styles.countBadge, { backgroundColor: `${colors.accent}14` }]}>
          <AppText style={[styles.countText, { color: colors.accent }]}>
            {posts.length} {posts.length === 1 ? 'post' : 'posts'}
          </AppText>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Content */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={() => {
            setIsRefreshing(true);
            void loadPosts().finally(() => setIsRefreshing(false));
          }}
          refreshing={isRefreshing}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
              <AppText style={[styles.emptyTitle, { color: colors.textPrimary }]}>no posts yet</AppText>
              <AppText style={[styles.emptySub, { color: colors.textMuted }]}>
                share your first real moment with the world
              </AppText>
              <TouchableOpacity
                style={[styles.createBtn, { backgroundColor: colors.accent }]}
                onPress={() => navigation.navigate('Create')}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={18} color="#FFF" />
                <AppText style={styles.createBtnText}>create post</AppText>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* â”€â”€ Edit Modal â”€â”€ */}
      <Modal
        visible={editingPost !== null}
        transparent
        animationType="slide"
        onRequestClose={closeEdit}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeEdit} />

          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            {/* Modal header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={closeEdit} style={styles.modalCancelBtn} activeOpacity={0.7}>
                <AppText style={[styles.modalCancelText, { color: colors.textMuted }]}>cancel</AppText>
              </TouchableOpacity>
              <AppText style={[styles.modalTitle, { color: colors.textPrimary }]}>edit post</AppText>
              <TouchableOpacity
                style={[
                  styles.modalSaveBtn,
                  { backgroundColor: isOverLimit ? colors.error : colors.accent },
                ]}
                onPress={handleSave}
                disabled={isSaving || isOverLimit || !editText.trim()}
                activeOpacity={0.85}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <AppText style={styles.modalSaveText}>save</AppText>
                )}
              </TouchableOpacity>
            </View>

            {/* Editor */}
            <TextInput
              style={[styles.editor, { color: colors.textPrimary }, webInputReset]}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
              placeholder="what's on your mind?"
              placeholderTextColor={colors.textMuted}
              maxLength={MAX_CHARS + 20}
            />

            {/* Char counter */}
            <View style={[styles.editorFooter, { borderTopColor: colors.border }]}>
              <AppText
                style={[
                  styles.charCount,
                  {
                    color:
                      charsLeft <= 30
                        ? isOverLimit
                          ? colors.error
                          : '#F59E0B'
                        : colors.textMuted,
                  },
                ]}
              >
                {charsLeft} chars left
              </AppText>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
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
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    backBtn: {
      width: 38, height: 38, borderRadius: 12, backgroundColor: c.surface2,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarCircle: {
      width: 36, height: 36, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarLetter: { fontSize: 16, fontWeight: typography.weights.bold, color: '#FFF', lineHeight: 20 },
    headerLabel: { fontSize: typography.sizes.xs },
    headerUsername: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold },
    countBadge: {
      paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
      borderRadius: 10,
    },
    countText: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },

    divider: { height: 1 },

    // List
    listContent: { padding: spacing.lg, paddingBottom: spacing.xxxxl },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    // Post card
    card: {
      borderRadius: 16, borderWidth: 1,
      padding: spacing.md, marginBottom: spacing.md,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    cardMeta: { flex: 1, marginLeft: spacing.sm },
    cardUsername: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
    cardTime: { fontSize: typography.sizes.xs, marginTop: 2 },
    cardActions: { flexDirection: 'row', gap: spacing.xs },
    actionBtn: {
      width: 32, height: 32, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
    },
    cardText: {
      fontSize: typography.sizes.sm, lineHeight: typography.sizes.sm * 1.6,
      marginBottom: spacing.md,
    },
    cardFooter: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      paddingTop: spacing.sm, borderTopWidth: 1,
    },
    stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statText: { fontSize: typography.sizes.xs },
    authBadge: {
      marginLeft: 'auto', paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 8,
    },
    authText: { fontSize: 10, fontWeight: typography.weights.semibold },

    // Empty state
    emptyState: {
      paddingTop: 80, alignItems: 'center', gap: spacing.sm,
      paddingHorizontal: spacing.xl,
    },
    emptyTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, marginTop: spacing.sm },
    emptySub: { fontSize: typography.sizes.sm, textAlign: 'center', lineHeight: typography.sizes.sm * 1.7, marginBottom: spacing.md },
    createBtn: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
      paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: 14,
    },
    createBtnText: { color: '#FFF', fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },

    // Edit modal
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
    modalSheet: {
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      minHeight: 340,
      shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.12, shadowRadius: 20, elevation: 30,
    },
    modalHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1,
    },
    modalCancelBtn: { paddingVertical: 4, paddingHorizontal: 2 },
    modalCancelText: { fontSize: typography.sizes.sm },
    modalTitle: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold },
    modalSaveBtn: {
      paddingHorizontal: spacing.lg, paddingVertical: spacing.xs + 2,
      borderRadius: 10, minWidth: 56, alignItems: 'center',
    },
    modalSaveText: { color: '#FFF', fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
    editor: {
      padding: spacing.lg, fontSize: typography.sizes.md,
      lineHeight: typography.sizes.md * 1.7,
      minHeight: 180, textAlignVertical: 'top',
    },
    editorFooter: {
      paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
      borderTopWidth: 1, alignItems: 'flex-end',
    },
    charCount: { fontSize: typography.sizes.xs, fontWeight: typography.weights.medium },
  });
}

export default MyPostsScreen;
