import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  TouchableOpacity,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { TabParamList } from '../types';
import { postApi } from '../services/postApi';
import { getApiError } from '../context/AuthContext';
import { webInputReset } from '../utils/webStyle';
import { useColors, Colors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import AppText from '../components/atoms/Text';

type CreateNavProp = BottomTabNavigationProp<TabParamList, 'Create'>;
interface CreatePostScreenProps { navigation: CreateNavProp; }

const MAX_CHARS = 280;
const MIN_CHARS = 3;

const CreatePostScreen: React.FC<CreatePostScreenProps> = ({ navigation }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [text, setText] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [touched, setTouched] = useState(false);

  const trimmed = text.trim();
  const charCount = trimmed.length;
  const charsRemaining = MAX_CHARS - text.length;
  const isOverLimit = charsRemaining < 0;
  const isTooShort = charCount < MIN_CHARS;
  const isEmpty = charCount === 0;

  // Inline validation message — only shown after first submit attempt
  const validationError = useMemo(() => {
    if (!touched) return '';
    if (isEmpty) return 'write something before posting';
    if (isTooShort) return `at least ${MIN_CHARS} characters required`;
    if (isOverLimit) return `${Math.abs(charsRemaining)} characters over the limit`;
    return '';
  }, [touched, isEmpty, isTooShort, isOverLimit, charsRemaining]);

  const canPost = !isEmpty && !isOverLimit && !isTooShort && !isPosting;

  const handlePost = useCallback(async () => {
    setTouched(true);
    if (!canPost) return;
    setSubmitError('');
    setIsPosting(true);
    try {
      await postApi.createPost({ text: trimmed });
      navigation.navigate('Feed');
    } catch (err) {
      setSubmitError(getApiError(err));
    } finally {
      setIsPosting(false);
    }
  }, [canPost, trimmed, navigation]);

  const handleCancel = useCallback(() => {
    navigation.navigate('Feed');
  }, [navigation]);

  // Progress ring percentage for the character count indicator
  const progress = Math.min(text.length / MAX_CHARS, 1);
  const isNearLimit = charsRemaining >= 0 && charsRemaining <= 30;

  const counterColor = isOverLimit
    ? colors.error
    : isNearLimit
    ? '#F59E0B'
    : colors.textMuted;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} activeOpacity={0.7} style={styles.headerBtn}>
            <AppText style={styles.cancelText}>cancel</AppText>
          </TouchableOpacity>
          <AppText style={styles.headerTitle}>new post</AppText>
          <TouchableOpacity
            onPress={handlePost}
            activeOpacity={canPost ? 0.7 : 1}
            style={styles.headerBtn}
          >
            {isPosting ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <AppText style={[styles.postText, !canPost && styles.postTextDisabled]}>post</AppText>
            )}
          </TouchableOpacity>
        </View>

        {/* Validation / API error banner */}
        {(validationError.length > 0 || submitError.length > 0) && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={15} color={colors.error} />
            <AppText style={styles.errorBannerText}>{validationError || submitError}</AppText>
          </View>
        )}

        <ScrollView
          style={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inputArea}>
            <TextInput
              style={[styles.textInput, webInputReset]}
              value={text}
              onChangeText={(v) => {
                setText(v);
                setSubmitError('');
              }}
              placeholder="what's real right now?"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={MAX_CHARS}
              autoFocus
              textAlignVertical="top"
            />
          </View>
        </ScrollView>

        {/* Footer bar */}
        <View style={styles.footerBar}>
          {/* Char count */}
          <View style={styles.charCountBlock}>
            {isOverLimit ? (
              <AppText style={[styles.charCountText, { color: colors.error }]}>
                {Math.abs(charsRemaining)} over
              </AppText>
            ) : isNearLimit ? (
              <AppText style={[styles.charCountText, { color: '#F59E0B' }]}>
                {charsRemaining} left
              </AppText>
            ) : (
              <AppText style={styles.charCountText}>{charsRemaining}</AppText>
            )}

            {/* Visual arc progress */}
            <View style={styles.progressRing}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: counterColor,
                    transform: [{ scaleX: Math.min(progress, 1) }],
                  },
                ]}
              />
            </View>
          </View>

          {/* Rules hint */}
          {isEmpty && (
            <AppText style={styles.hint}>
              min {MIN_CHARS} · max {MAX_CHARS} characters
            </AppText>
          )}
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    headerBtn: { minWidth: 60 },
    headerTitle: {
      color: c.textPrimary,
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold,
    },
    cancelText: { color: c.textSecondary, fontSize: typography.sizes.md },
    postText: {
      color: c.accent,
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold,
      textAlign: 'right',
    },
    postTextDisabled: { color: c.textMuted },
    // Validation banner
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: `${c.error}10`,
      borderBottomWidth: 1,
      borderBottomColor: `${c.error}20`,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    errorBannerText: { color: c.error, fontSize: typography.sizes.sm, flex: 1 },
    scroll: { flex: 1 },
    inputArea: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      minHeight: 180,
    },
    textInput: {
      color: c.textPrimary,
      fontSize: typography.sizes.lg,
      lineHeight: typography.sizes.lg * 1.6,
      fontWeight: typography.weights.regular,
      minHeight: 140,
      outlineWidth: 0,
    } as any,
    footerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    charCountBlock: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    charCountText: { fontSize: typography.sizes.sm, color: c.textMuted, fontWeight: typography.weights.medium },
    progressRing: {
      width: 32, height: 4, borderRadius: 2,
      backgroundColor: c.border, overflow: 'hidden',
    },
    progressFill: {
      position: 'absolute', left: 0, top: 0, bottom: 0, right: 0,
      borderRadius: 2,
      transformOrigin: 'left',
    },
    hint: {
      fontSize: typography.sizes.xs,
      color: c.textMuted,
    },
  });
}

export default CreatePostScreen;
