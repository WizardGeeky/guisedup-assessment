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
  Image,
  ScrollView,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { TabParamList } from '../types';
import { postApi } from '../services/postApi';
import { searchApi } from '../services/searchApi';
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

const MAX_CONTENT_CHARS = 280;
const MENTION_REGEX = /@(\w*)$/;

// ── Text helpers ─────────────────────────────────────────────────────────────

interface ParsedPost {
  heading: string;
  content: string;
  link: string;
  tags: string[];
}

function parsePostText(fullText: string): ParsedPost {
  const parts = fullText.split('\n\n');
  let tags: string[] = [];
  let link = '';

  const last = parts[parts.length - 1] ?? '';
  if (/^#\w+/.test(last)) {
    tags = (last.match(/#(\w+)/g) ?? []).map((t) => t.slice(1));
    parts.pop();
  }

  const newLast = parts[parts.length - 1] ?? '';
  if (newLast.startsWith('🔗 ')) {
    link = newLast.replace(/^🔗\s*/, '').trim();
    parts.pop();
  }

  let heading = '';
  let content = '';
  if (parts.length >= 2) {
    heading = parts[0];
    content = parts.slice(1).join('\n\n');
  } else {
    content = parts[0] ?? '';
  }

  return { heading, content, link, tags };
}

function composePostText(heading: string, content: string, link: string, tags: string[]): string {
  const parts: string[] = [];
  if (heading.trim()) parts.push(heading.trim());
  parts.push(content.trim());
  if (link.trim()) parts.push(`🔗 ${link.trim()}`);
  if (tags.length) parts.push(tags.map((t) => `#${t}`).join(' '));
  return parts.join('\n\n');
}

// ── Mention-highlighted text ──────────────────────────────────────────────────

function HighlightedText({
  text,
  style,
  mentionColor,
  numberOfLines,
}: {
  text: string;
  style?: object;
  mentionColor: string;
  numberOfLines?: number;
}) {
  const parts = text.split(/(@\w+)/g);
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <Text key={i} style={{ color: mentionColor, fontWeight: '600' }}>{part}</Text>
        ) : (
          part
        )
      )}
    </Text>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

const MyPostsScreen: React.FC<Props> = ({ navigation }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();

  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Edit modal state
  const [editingPost, setEditingPost] = useState<ApiPost | null>(null);
  const [editHeading, setEditHeading] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState('');
  const [editLink, setEditLink] = useState('');
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const [showTagInput, setShowTagInput] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<string[]>([]);
  const [isMentionLoading, setIsMentionLoading] = useState(false);
  const mentionDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<TextInput>(null);

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
    const parsed = parsePostText(post.text);
    setEditingPost(post);
    setEditHeading(parsed.heading);
    setEditContent(parsed.content);
    setEditTags(parsed.tags);
    setEditLink(parsed.link);
    setEditImageUrl(post.imageUrl);
    setShowTagInput(false);
    setShowLinkInput(false);
    setMentionQuery(null);
    setMentionResults([]);
  }, []);

  const closeEdit = useCallback(() => {
    setEditingPost(null);
    setEditHeading('');
    setEditContent('');
    setEditTags([]);
    setEditTagInput('');
    setEditLink('');
    setEditImageUrl(null);
    setShowTagInput(false);
    setShowLinkInput(false);
    setMentionQuery(null);
    setMentionResults([]);
  }, []);

  // @mention autocomplete in edit content
  const handleEditContentChange = (text: string) => {
    setEditContent(text);
    const match = MENTION_REGEX.exec(text);
    if (match) {
      const q = match[1];
      setMentionQuery(q);
      if (mentionDebounce.current) clearTimeout(mentionDebounce.current);
      if (!q.length) { setMentionResults([]); return; }
      setIsMentionLoading(true);
      mentionDebounce.current = setTimeout(async () => {
        try {
          const results = await searchApi.search(q, 5);
          setMentionResults([...new Set(results.map((r) => r.post.author.username))]);
        } catch { setMentionResults([]); }
        finally { setIsMentionLoading(false); }
      }, 300);
    } else {
      setMentionQuery(null);
      setMentionResults([]);
    }
  };

  const insertMention = (username: string) => {
    setEditContent(editContent.replace(MENTION_REGEX, `@${username} `));
    setMentionQuery(null);
    setMentionResults([]);
    setTimeout(() => contentRef.current?.focus(), 50);
  };

  const addTag = () => {
    const raw = editTagInput.trim().replace(/^#/, '').toLowerCase();
    if (raw && !editTags.includes(raw) && editTags.length < 5) {
      setEditTags([...editTags, raw]);
    }
    setEditTagInput('');
  };

  const pickEditImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.6,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const dataUri = asset.base64
        ? `data:image/jpeg;base64,${asset.base64}`
        : asset.uri;
      setEditImageUrl(dataUri);
    }
  };

  const handleSave = useCallback(async () => {
    if (!editingPost || !editContent.trim()) return;
    setIsSaving(true);
    try {
      const composed = composePostText(editHeading, editContent, editLink, editTags);
      const updated = await postApi.updatePost(editingPost.id, composed, editImageUrl);
      setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      closeEdit();
    } catch {
      Alert.alert('Error', 'Failed to update post. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [editingPost, editHeading, editContent, editTags, editLink, editImageUrl, closeEdit]);

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

  const charsLeft = MAX_CONTENT_CHARS - editContent.length;
  const isOverLimit = charsLeft < 0;
  const canSave = editContent.trim().length >= 3 && !isOverLimit && !isSaving;

  const renderItem = useCallback(
    ({ item }: { item: ApiPost }) => {
      const isDeleting = deletingId === item.id;
      const parsed = parsePostText(item.text);
      return (
        <View style={styles.card}>
          {/* Card header */}
          <View style={styles.cardHeader}>
            <Avatar username={item.author.username} size={38} imageUrl={item.author.avatarUrl} />
            <View style={styles.cardMeta}>
              <AppText style={styles.cardUsername}>{item.author.username}</AppText>
              <AppText style={styles.cardTime}>{formatTimeAgo(item.createdAt)}</AppText>
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

          {/* Heading */}
          {parsed.heading ? (
            <AppText style={styles.cardHeading}>{parsed.heading}</AppText>
          ) : null}

          {/* Body with @mention highlights */}
          <HighlightedText
            text={parsed.content}
            style={[styles.cardText, { color: colors.textPrimary }]}
            mentionColor={colors.accent}
            numberOfLines={6}
          />

          {/* Image */}
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.cardImage} resizeMode="cover" />
          ) : null}

          {/* Link */}
          {parsed.link ? (
            <View style={[styles.linkRow, { backgroundColor: `${colors.accent}0E` }]}>
              <Ionicons name="link-outline" size={13} color={colors.accent} />
              <AppText style={[styles.linkText, { color: colors.accent }]} numberOfLines={1}>
                {parsed.link}
              </AppText>
            </View>
          ) : null}

          {/* Tags */}
          {parsed.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {parsed.tags.map((tag) => (
                <View key={tag} style={[styles.tagChip, { backgroundColor: `${colors.accent}14` }]}>
                  <AppText style={[styles.tagChipText, { color: colors.accent }]}>#{tag}</AppText>
                </View>
              ))}
            </View>
          )}

          {/* Footer stats */}
          <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
            <View style={styles.stat}>
              <Ionicons name="heart-outline" size={14} color={colors.textMuted} />
              <AppText style={styles.statText}>{item._count?.interactions ?? 0}</AppText>
            </View>
            <View style={styles.stat}>
              <Ionicons name="eye-outline" size={14} color={colors.textMuted} />
              <AppText style={styles.statText}>{item.viewCount ?? 0}</AppText>
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

  const displayName = user?.username ? `@${user.username}` : '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.navigate('Feed')}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerLeft}>
          <Avatar username={user?.username ?? ''} size={36} imageUrl={user?.avatarUrl} />
          <View>
            <AppText style={styles.headerLabel}>my posts</AppText>
            <AppText style={styles.headerUsername}>{displayName}</AppText>
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

      {/* ── Edit Modal ── */}
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
                  { backgroundColor: canSave ? colors.accent : colors.border },
                ]}
                onPress={handleSave}
                disabled={!canSave}
                activeOpacity={0.85}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <AppText style={styles.modalSaveText}>save</AppText>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.editorScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Heading input */}
              <TextInput
                style={[styles.headingInput, { color: colors.textPrimary }, webInputReset]}
                value={editHeading}
                onChangeText={setEditHeading}
                placeholder="add a title (optional)"
                placeholderTextColor={colors.textMuted}
                maxLength={100}
                returnKeyType="next"
              />

              {editHeading.length > 0 && (
                <View style={[styles.headingDivider, { backgroundColor: colors.border }]} />
              )}

              {/* Content input */}
              <TextInput
                ref={contentRef}
                style={[styles.editor, { color: colors.textPrimary }, webInputReset]}
                value={editContent}
                onChangeText={handleEditContentChange}
                multiline
                placeholder="what's real right now? use @ to mention someone…"
                placeholderTextColor={colors.textMuted}
                textAlignVertical="top"
                autoCapitalize="sentences"
              />

              {/* @mention dropdown */}
              {mentionQuery !== null && (
                <View style={[styles.mentionDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {isMentionLoading ? (
                    <View style={styles.mentionPad}>
                      <ActivityIndicator size="small" color={colors.accent} />
                    </View>
                  ) : mentionResults.length === 0 ? (
                    <View style={styles.mentionPad}>
                      <AppText style={{ color: colors.textMuted, fontSize: typography.sizes.sm, textAlign: 'center' }}>
                        {mentionQuery.length === 0 ? 'start typing a username…' : `no users matching "@${mentionQuery}"`}
                      </AppText>
                    </View>
                  ) : (
                    mentionResults.map((username) => (
                      <TouchableOpacity
                        key={username}
                        style={[styles.mentionRow, { borderBottomColor: colors.border }]}
                        onPress={() => insertMention(username)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.mentionAvatar, { backgroundColor: colors.accent }]}>
                          <AppText style={styles.mentionAvatarText}>{username[0].toUpperCase()}</AppText>
                        </View>
                        <AppText style={{ color: colors.textPrimary, fontSize: typography.sizes.md, fontWeight: typography.weights.medium }}>
                          @{username}
                        </AppText>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}

              {/* Tags */}
              {(editTags.length > 0 || showTagInput) && (
                <View style={styles.tagsSection}>
                  {editTags.length > 0 && (
                    <View style={styles.editTagsRow}>
                      {editTags.map((tag) => (
                        <TouchableOpacity
                          key={tag}
                          style={[styles.editTagChip, { backgroundColor: `${colors.accent}14`, borderColor: `${colors.accent}30` }]}
                          onPress={() => setEditTags(editTags.filter((t) => t !== tag))}
                          activeOpacity={0.7}
                        >
                          <AppText style={[styles.tagChipText, { color: colors.accent }]}>#{tag}</AppText>
                          <Ionicons name="close" size={11} color={colors.accent} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {showTagInput && editTags.length < 5 && (
                    <View style={[styles.tagInputRow, { backgroundColor: colors.surface2 }]}>
                      <AppText style={[styles.tagHash, { color: colors.accent }]}>#</AppText>
                      <TextInput
                        style={[styles.tagInput, webInputReset, { color: colors.textPrimary }]}
                        value={editTagInput}
                        onChangeText={(t) => setEditTagInput(t.replace(/\s/g, '').toLowerCase())}
                        placeholder="add tag, press enter"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                        returnKeyType="done"
                        onSubmitEditing={addTag}
                        blurOnSubmit={false}
                        maxLength={20}
                      />
                      <TouchableOpacity onPress={addTag} activeOpacity={0.7} style={{ padding: 4 }}>
                        <Ionicons name="return-down-back-outline" size={16} color={colors.accent} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {/* Link input */}
              {showLinkInput && (
                <View style={[styles.linkInputRow, { backgroundColor: colors.surface2 }]}>
                  <Ionicons name="link-outline" size={17} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
                  <TextInput
                    style={[styles.linkInputField, webInputReset, { color: colors.textPrimary }]}
                    value={editLink}
                    onChangeText={setEditLink}
                    placeholder="paste a link…"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                  />
                  {editLink.length > 0 && (
                    <TouchableOpacity onPress={() => setEditLink('')} activeOpacity={0.7}>
                      <Ionicons name="close-circle" size={17} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Image preview */}
              {editImageUrl ? (
                <View style={styles.imagePreviewWrap}>
                  <Image source={{ uri: editImageUrl }} style={styles.imagePreview} resizeMode="cover" />
                  <TouchableOpacity
                    style={[styles.imageRemoveBtn, { backgroundColor: colors.textPrimary }]}
                    onPress={() => setEditImageUrl(null)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close" size={12} color={colors.background} />
                  </TouchableOpacity>
                </View>
              ) : null}
            </ScrollView>

            {/* ── Toolbar ── */}
            <View style={[styles.toolbar, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
              <View style={styles.toolbarLeft}>
                {/* Image */}
                <TouchableOpacity
                  style={[styles.toolbarBtn, editImageUrl ? styles.toolbarBtnActive : null]}
                  onPress={pickEditImage}
                  activeOpacity={0.7}
                >
                  <Ionicons name="image-outline" size={22} color={editImageUrl ? colors.accent : colors.textSecondary} />
                </TouchableOpacity>

                {/* Link */}
                <TouchableOpacity
                  style={[styles.toolbarBtn, showLinkInput ? styles.toolbarBtnActive : null]}
                  onPress={() => setShowLinkInput((v) => !v)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="link-outline" size={22} color={showLinkInput ? colors.accent : colors.textSecondary} />
                </TouchableOpacity>

                {/* Tag */}
                <TouchableOpacity
                  style={[styles.toolbarBtn, (showTagInput || editTags.length > 0) ? styles.toolbarBtnActive : null]}
                  onPress={() => setShowTagInput((v) => !v)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="pricetag-outline" size={20} color={(showTagInput || editTags.length > 0) ? colors.accent : colors.textSecondary} />
                  {editTags.length > 0 && (
                    <View style={[styles.toolbarBadge, { backgroundColor: colors.accent }]}>
                      <AppText style={styles.toolbarBadgeText}>{editTags.length}</AppText>
                    </View>
                  )}
                </TouchableOpacity>

                {/* @ mention */}
                <TouchableOpacity
                  style={styles.toolbarBtn}
                  onPress={() => {
                    setEditContent((c) => c + '@');
                    setTimeout(() => contentRef.current?.focus(), 50);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="at-outline" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Char counter */}
              <AppText style={[styles.charCount, {
                color: isOverLimit ? colors.error : charsLeft <= 30 ? '#F59E0B' : colors.textMuted,
              }]}>
                {charsLeft}
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
    backBtn: {
      width: 38, height: 38, borderRadius: 12, backgroundColor: c.surface2,
      alignItems: 'center', justifyContent: 'center', marginRight: spacing.xs,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
    headerLabel: { fontSize: typography.sizes.xs, color: c.textMuted },
    headerUsername: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, color: c.textPrimary },
    countBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 10 },
    countText: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },

    divider: { height: 1 },

    // List
    listContent: { padding: spacing.lg, paddingBottom: spacing.xxxxl },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    // Post card
    card: {
      backgroundColor: c.surface, borderRadius: 18,
      padding: spacing.md, marginBottom: spacing.md,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    cardMeta: { flex: 1, marginLeft: spacing.sm },
    cardUsername: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: c.textPrimary },
    cardTime: { fontSize: typography.sizes.xs, marginTop: 2, color: c.textMuted },
    cardActions: { flexDirection: 'row', gap: spacing.xs },
    actionBtn: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    cardHeading: {
      fontSize: typography.sizes.md + 1, fontWeight: typography.weights.bold,
      color: c.textPrimary, marginBottom: spacing.xs,
    },
    cardText: {
      fontSize: typography.sizes.sm, lineHeight: typography.sizes.sm * 1.65,
      marginBottom: spacing.sm, color: c.textPrimary,
    },
    cardImage: {
      width: '100%', aspectRatio: 16 / 9, borderRadius: 12, marginBottom: spacing.sm,
    },
    linkRow: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: spacing.sm, paddingVertical: spacing.xs + 1,
      borderRadius: 8, marginBottom: spacing.sm,
    },
    linkText: { fontSize: typography.sizes.xs, flex: 1 },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
    tagChip: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 8 },
    tagChipText: { fontSize: 11, fontWeight: typography.weights.semibold },
    cardFooter: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      paddingTop: spacing.sm, borderTopWidth: 1,
    },
    stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statText: { fontSize: typography.sizes.xs, color: c.textMuted },
    authBadge: { marginLeft: 'auto', paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 8 },
    authText: { fontSize: 10, fontWeight: typography.weights.semibold },

    // Empty state
    emptyState: { paddingTop: 80, alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl },
    emptyTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, marginTop: spacing.sm },
    emptySub: { fontSize: typography.sizes.sm, textAlign: 'center', lineHeight: typography.sizes.sm * 1.7, marginBottom: spacing.md },
    createBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: 14 },
    createBtnText: { color: '#FFF', fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },

    // Edit modal
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    modalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
    modalSheet: {
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      maxHeight: '90%',
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
    modalSaveBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs + 2, borderRadius: 10, minWidth: 56, alignItems: 'center' },
    modalSaveText: { color: '#FFF', fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },

    // Editor internals
    editorScroll: { maxHeight: 420 },
    headingInput: {
      paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
      fontSize: 18, fontWeight: typography.weights.bold,
    } as any,
    headingDivider: { height: 1, marginHorizontal: spacing.lg, marginBottom: spacing.sm },
    editor: {
      paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
      fontSize: typography.sizes.md, lineHeight: typography.sizes.md * 1.65,
      minHeight: 120, textAlignVertical: 'top',
    } as any,

    mentionDropdown: {
      marginHorizontal: spacing.lg, borderRadius: 14, borderWidth: 1, overflow: 'hidden',
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
    },
    mentionPad: { padding: spacing.md, alignItems: 'center' },
    mentionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1 },
    mentionAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    mentionAvatarText: { fontSize: 14, fontWeight: typography.weights.bold, color: '#FFF' },

    tagsSection: { paddingHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.xs },
    editTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
    editTagChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 8, borderWidth: 1 },
    tagInputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: spacing.md, height: 40 },
    tagHash: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, marginRight: 2 },
    tagInput: { flex: 1, fontSize: typography.sizes.md },

    linkInputRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.sm, borderRadius: 12, paddingHorizontal: spacing.md, height: 46 },
    linkInputField: { flex: 1, fontSize: typography.sizes.md },

    imagePreviewWrap: { marginHorizontal: spacing.lg, marginTop: spacing.md, position: 'relative', alignSelf: 'flex-start' },
    imagePreview: { width: 160, height: 100, borderRadius: 12 },
    imageRemoveBtn: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },

    toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1 },
    toolbarLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    toolbarBtn: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    toolbarBtnActive: { backgroundColor: `${c.accent}14` },
    toolbarBadge: { position: 'absolute', top: 4, right: 4, width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
    toolbarBadgeText: { fontSize: 9, color: '#FFF', fontWeight: typography.weights.bold },
    charCount: { fontSize: typography.sizes.sm, fontWeight: typography.weights.medium },
  });
}

export default MyPostsScreen;
