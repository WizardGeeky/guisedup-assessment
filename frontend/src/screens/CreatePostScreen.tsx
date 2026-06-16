import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  TouchableOpacity,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { TabParamList } from '../types';
import { postApi } from '../services/postApi';
import { searchApi } from '../services/searchApi';
import { getApiError } from '../context/AuthContext';
import { useAuth } from '../context/AuthContext';
import { webInputReset } from '../utils/webStyle';
import { useColors, Colors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import AppText from '../components/atoms/Text';

type CreateNavProp = BottomTabNavigationProp<TabParamList, 'Create'>;
interface CreatePostScreenProps { navigation: CreateNavProp; }

const MAX_CHARS = 280;
const MENTION_REGEX = /@(\w*)$/;

const CreatePostScreen: React.FC<CreatePostScreenProps> = ({ navigation }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();

  const [heading, setHeading] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [link, setLink] = useState('');
  const [images, setImages] = useState<string[]>([]);

  const [isPosting, setIsPosting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [touched, setTouched] = useState(false);

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<string[]>([]);
  const [isMentionLoading, setIsMentionLoading] = useState(false);
  const mentionDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<TextInput>(null);

  const charsUsed = content.length;
  const charsRemaining = MAX_CHARS - charsUsed;
  const isOverLimit = charsRemaining < 0;
  const isNearLimit = charsRemaining >= 0 && charsRemaining <= 30;
  const canPost = content.trim().length >= 3 && !isOverLimit && !isPosting;

  const handleContentChange = (text: string) => {
    setContent(text);
    setSubmitError('');
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
    setContent(content.replace(MENTION_REGEX, `@${username} `));
    setMentionQuery(null);
    setMentionResults([]);
    setTimeout(() => contentRef.current?.focus(), 50);
  };

  const addTag = () => {
    const raw = tagInput.trim().replace(/^#/, '').toLowerCase();
    if (raw && !tags.includes(raw) && tags.length < 5) setTags([...tags, raw]);
    setTagInput('');
  };

  const pickImage = async () => {
    if (images.length >= 4) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { setSubmitError('photo access is required'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.6,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      // Convert to data URI so it can be stored in DB and displayed anywhere
      const dataUri = asset.base64
        ? `data:image/jpeg;base64,${asset.base64}`
        : asset.uri;
      setImages([...images, dataUri]);
    }
  };

  const composeText = () => {
    const parts: string[] = [];
    if (heading.trim()) parts.push(heading.trim());
    parts.push(content.trim());
    if (link.trim()) parts.push(`🔗 ${link.trim()}`);
    if (tags.length) parts.push(tags.map((t) => `#${t}`).join(' '));
    return parts.join('\n\n');
  };

  const handlePost = useCallback(async () => {
    setTouched(true);
    if (!canPost) return;
    setSubmitError('');
    setIsPosting(true);
    try {
      await postApi.createPost({ text: composeText(), imageUrl: images[0] ?? undefined });
      navigation.navigate('Feed');
    } catch (err) {
      setSubmitError(getApiError(err));
    } finally { setIsPosting(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPost, content, heading, link, tags, images, navigation]);

  const counterColor = isOverLimit ? colors.error : isNearLimit ? '#F59E0B' : colors.textMuted;
  const progress = Math.min(charsUsed / MAX_CHARS, 1);
  const initials = user?.username ? user.username[0].toUpperCase() : 'G';
  const validationError = touched && content.trim().length < 3
    ? (content.trim().length === 0 ? 'write something before posting' : 'at least 3 characters required')
    : '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Feed')} style={styles.cancelBtn} activeOpacity={0.7}>
          <AppText style={styles.cancelText}>cancel</AppText>
        </TouchableOpacity>
        <AppText style={styles.headerTitle}>new post</AppText>
        <TouchableOpacity
          onPress={handlePost}
          activeOpacity={canPost ? 0.85 : 1}
          style={[styles.postBtn, { backgroundColor: canPost ? colors.accent : colors.border }]}
        >
          {isPosting
            ? <ActivityIndicator size="small" color="#FFF" />
            : <AppText style={styles.postBtnText}>post</AppText>}
        </TouchableOpacity>
      </View>

      {(validationError || submitError) ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
          <AppText style={styles.errorBannerText}>{validationError || submitError}</AppText>
        </View>
      ) : null}

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Author row */}
          <View style={styles.authorRow}>
            <View style={[styles.authorAvatar, { backgroundColor: colors.accent }]}>
              <AppText style={styles.authorInitial}>{initials}</AppText>
            </View>
            <View>
              <AppText style={styles.authorName}>{user?.username ?? 'you'}</AppText>
              <View style={styles.audiencePill}>
                <Ionicons name="globe-outline" size={10} color={colors.textMuted} />
                <AppText style={styles.audienceText}>public</AppText>
              </View>
            </View>
          </View>

          {/* Heading */}
          <TextInput
            style={[styles.headingInput, webInputReset]}
            value={heading}
            onChangeText={setHeading}
            placeholder="add a title (optional)"
            placeholderTextColor={colors.textMuted}
            maxLength={100}
            returnKeyType="next"
            autoCapitalize="sentences"
          />

          {/* Divider under heading */}
          {heading.length > 0 && <View style={styles.headingDivider} />}

          {/* Content */}
          <TextInput
            ref={contentRef}
            style={[styles.contentInput, webInputReset]}
            value={content}
            onChangeText={handleContentChange}
            placeholder="what's real right now? use @ to mention someone…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={MAX_CHARS + 20}
            textAlignVertical="top"
            autoFocus
            autoCapitalize="sentences"
          />

          {/* @mention dropdown */}
          {mentionQuery !== null && (
            <View style={[styles.mentionDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {isMentionLoading ? (
                <View style={styles.mentionPad}><ActivityIndicator size="small" color={colors.accent} /></View>
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

          {/* Tags section */}
          {(tags.length > 0 || showTagInput) && (
            <View style={styles.tagsSection}>
              {tags.length > 0 && (
                <View style={styles.tagsRow}>
                  {tags.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={[styles.tagChip, { backgroundColor: `${colors.accent}14`, borderColor: `${colors.accent}30` }]}
                      onPress={() => setTags(tags.filter((t) => t !== tag))}
                      activeOpacity={0.7}
                    >
                      <AppText style={[styles.tagChipText, { color: colors.accent }]}>#{tag}</AppText>
                      <Ionicons name="close" size={11} color={colors.accent} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {showTagInput && tags.length < 5 && (
                <View style={[styles.tagInputRow, { backgroundColor: colors.surface2 }]}>
                  <AppText style={[styles.tagHash, { color: colors.accent }]}>#</AppText>
                  <TextInput
                    style={[styles.tagInput, webInputReset, { color: colors.textPrimary }]}
                    value={tagInput}
                    onChangeText={(t) => setTagInput(t.replace(/\s/g, '').toLowerCase())}
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
              {tags.length >= 5 && (
                <AppText style={{ color: colors.textMuted, fontSize: typography.sizes.xs, marginTop: 4 }}>max 5 tags</AppText>
              )}
            </View>
          )}

          {/* Link input */}
          {showLinkInput && (
            <View style={[styles.linkRow, { backgroundColor: colors.surface2 }]}>
              <Ionicons name="link-outline" size={17} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
              <TextInput
                style={[styles.linkInput, webInputReset, { color: colors.textPrimary }]}
                value={link}
                onChangeText={setLink}
                placeholder="paste a link…"
                placeholderTextColor={colors.textMuted}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
              />
              {link.length > 0 && (
                <TouchableOpacity onPress={() => setLink('')} activeOpacity={0.7}>
                  <Ionicons name="close-circle" size={17} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Images */}
          {images.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesRow} contentContainerStyle={styles.imagesContent}>
              {images.map((uri, i) => (
                <View key={i} style={styles.imageThumbnailWrap}>
                  <Image source={{ uri }} style={styles.imageThumbnail} />
                  <TouchableOpacity
                    style={[styles.imageRemoveBtn, { backgroundColor: colors.textPrimary }]}
                    onPress={() => setImages(images.filter((_, j) => j !== i))}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close" size={11} color={colors.background} />
                  </TouchableOpacity>
                </View>
              ))}
              {images.length < 4 && (
                <TouchableOpacity style={[styles.addMoreImage, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={pickImage} activeOpacity={0.7}>
                  <Ionicons name="add" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </ScrollView>
          )}
        </ScrollView>

        {/* ── Toolbar ── */}
        <View style={[styles.toolbar, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={styles.toolbarLeft}>
            {/* Image */}
            <TouchableOpacity style={[styles.toolbarBtn, images.length > 0 && styles.toolbarBtnActive]} onPress={pickImage} activeOpacity={0.7} disabled={images.length >= 4}>
              <Ionicons name="image-outline" size={22} color={images.length >= 4 ? colors.textMuted : colors.textSecondary} />
              {images.length > 0 && <View style={[styles.badge, { backgroundColor: colors.accent }]}><AppText style={styles.badgeText}>{images.length}</AppText></View>}
            </TouchableOpacity>
            {/* Link */}
            <TouchableOpacity style={[styles.toolbarBtn, showLinkInput && styles.toolbarBtnActive]} onPress={() => setShowLinkInput((v) => !v)} activeOpacity={0.7}>
              <Ionicons name="link-outline" size={22} color={showLinkInput ? colors.accent : colors.textSecondary} />
            </TouchableOpacity>
            {/* Tag */}
            <TouchableOpacity style={[styles.toolbarBtn, showTagInput && styles.toolbarBtnActive]} onPress={() => setShowTagInput((v) => !v)} activeOpacity={0.7}>
              <Ionicons name="pricetag-outline" size={20} color={showTagInput ? colors.accent : colors.textSecondary} />
              {tags.length > 0 && <View style={[styles.badge, { backgroundColor: colors.accent }]}><AppText style={styles.badgeText}>{tags.length}</AppText></View>}
            </TouchableOpacity>
            {/* @ mention */}
            <TouchableOpacity
              style={styles.toolbarBtn}
              onPress={() => { setContent((c) => c + '@'); setTimeout(() => contentRef.current?.focus(), 50); }}
              activeOpacity={0.7}
            >
              <Ionicons name="at-outline" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.toolbarRight}>
            {(isNearLimit || isOverLimit) && (
              <AppText style={[styles.charCount, { color: counterColor }]}>
                {isOverLimit ? `-${Math.abs(charsRemaining)}` : charsRemaining}
              </AppText>
            )}
            <View style={styles.progressRing}>
              <View style={[styles.progressFill, { backgroundColor: counterColor, transform: [{ scaleX: Math.min(progress, 1) }] }]} />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

function createStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    cancelBtn: { minWidth: 60 },
    cancelText: { color: c.textSecondary, fontSize: typography.sizes.md },
    headerTitle: { color: c.textPrimary, fontSize: typography.sizes.md, fontWeight: typography.weights.semibold },
    postBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 20, minWidth: 60, alignItems: 'center' },
    postBtnText: { color: '#FFF', fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },

    errorBanner: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
      backgroundColor: `${c.error}10`, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
      borderBottomWidth: 1, borderBottomColor: `${c.error}20`,
    },
    errorBannerText: { color: c.error, fontSize: typography.sizes.sm, flex: 1 },

    scroll: { flex: 1 },
    scrollContent: { paddingBottom: spacing.lg },

    authorRow: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    },
    authorAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    authorInitial: { fontSize: 18, fontWeight: typography.weights.bold, color: '#FFF', lineHeight: 22 },
    authorName: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: c.textPrimary },
    audiencePill: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
      backgroundColor: c.surface2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
      alignSelf: 'flex-start', marginTop: 2,
    },
    audienceText: { fontSize: 10, color: c.textMuted, fontWeight: typography.weights.medium },

    headingInput: {
      paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
      fontSize: 20, fontWeight: typography.weights.bold, color: c.textPrimary,
    } as any,
    headingDivider: { height: 1, backgroundColor: c.border, marginHorizontal: spacing.lg, marginBottom: spacing.sm },
    contentInput: {
      paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
      fontSize: typography.sizes.md, color: c.textPrimary,
      lineHeight: typography.sizes.md * 1.65, minHeight: 140,
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
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
    tagChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 8, borderWidth: 1 },
    tagChipText: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
    tagInputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: spacing.md, height: 40 },
    tagHash: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, marginRight: 2 },
    tagInput: { flex: 1, fontSize: typography.sizes.md },

    linkRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.sm, borderRadius: 12, paddingHorizontal: spacing.md, height: 46 },
    linkInput: { flex: 1, fontSize: typography.sizes.md },

    imagesRow: { marginTop: spacing.md },
    imagesContent: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm },
    imageThumbnailWrap: { position: 'relative' },
    imageThumbnail: { width: 90, height: 90, borderRadius: 12 },
    imageRemoveBtn: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    addMoreImage: { width: 90, height: 90, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },

    toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1 },
    toolbarLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    toolbarBtn: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    toolbarBtnActive: { backgroundColor: `${c.accent}14` },
    badge: { position: 'absolute', top: 4, right: 4, width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
    badgeText: { fontSize: 9, color: '#FFF', fontWeight: typography.weights.bold },
    toolbarRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    charCount: { fontSize: typography.sizes.sm, fontWeight: typography.weights.medium },
    progressRing: { width: 36, height: 4, borderRadius: 2, backgroundColor: c.border, overflow: 'hidden' },
    progressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, right: 0, borderRadius: 2, transformOrigin: 'left' },
  });
}

export default CreatePostScreen;
