import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  TouchableOpacity,
  Platform,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { TabParamList } from '../types';
import { postApi } from '../services/postApi';
import { getApiError } from '../context/AuthContext';
import { useColors, Colors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import AppText from '../components/atoms/Text';

type CreateNavProp = BottomTabNavigationProp<TabParamList, 'Create'>;

interface CreatePostScreenProps {
  navigation: CreateNavProp;
}

const MAX_CHARS = 280;

const CreatePostScreen: React.FC<CreatePostScreenProps> = ({ navigation }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [text, setText] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  const charsRemaining = MAX_CHARS - text.length;
  const isOverLimit = charsRemaining < 0;
  const isEmpty = text.trim().length === 0;

  const handleCancel = useCallback(() => {
    navigation.navigate('Feed');
  }, [navigation]);

  const handlePost = useCallback(async () => {
    if (isEmpty || isOverLimit || isPosting) return;
    setIsPosting(true);
    try {
      await postApi.createPost({ text: text.trim() });
      navigation.navigate('Feed');
    } catch (err) {
      Alert.alert('post failed', getApiError(err));
    } finally {
      setIsPosting(false);
    }
  }, [isEmpty, isOverLimit, isPosting, text, navigation]);

  const canPost = !isEmpty && !isOverLimit && !isPosting;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} activeOpacity={0.7} style={styles.headerBtn}>
            <AppText variant="label" style={styles.cancelText}>
              cancel
            </AppText>
          </TouchableOpacity>
          <AppText variant="label" style={styles.headerTitle}>
            new post
          </AppText>
          <TouchableOpacity
            onPress={handlePost}
            activeOpacity={canPost ? 0.7 : 1}
            style={[styles.headerBtn, styles.postBtn, !canPost && styles.postBtnDisabled]}
            disabled={!canPost}
          >
            {isPosting ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <AppText
                variant="label"
                style={[styles.postText, !canPost && styles.postTextDisabled]}
              >
                post
              </AppText>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inputArea}>
            <TextInput
              style={styles.textInput}
              value={text}
              onChangeText={setText}
              placeholder="what's real right now?"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={MAX_CHARS + 20}
              autoFocus
              textAlignVertical="top"
            />
          </View>
        </ScrollView>

        <View style={styles.charCountRow}>
          <AppText
            variant="caption"
            style={[styles.charCount, isOverLimit && styles.charCountOver]}
          >
            {charsRemaining} characters remaining
          </AppText>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

function createStyles(c: Colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    flex: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    headerBtn: {
      minWidth: 60,
      paddingVertical: spacing.xs,
    },
    headerTitle: {
      color: c.textPrimary,
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold,
    },
    cancelText: {
      color: c.textSecondary,
      fontSize: typography.sizes.md,
    },
    postBtn: {
      alignItems: 'flex-end',
    },
    postBtnDisabled: {
      opacity: 0.35,
    },
    postText: {
      color: c.accent,
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold,
    },
    postTextDisabled: {
      color: c.textMuted,
    },
    scroll: {
      flex: 1,
    },
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
    },
    charCountRow: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: c.border,
      alignItems: 'flex-end',
    },
    charCount: {
      color: c.textMuted,
      fontSize: typography.sizes.xs,
    },
    charCountOver: {
      color: c.error,
    },
  });
}

export default CreatePostScreen;
