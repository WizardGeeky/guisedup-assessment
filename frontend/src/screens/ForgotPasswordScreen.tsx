import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  TouchableOpacity,
  Platform,
  StyleSheet,
  Animated,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AuthStackParamList } from '../types';
import { useColors, Colors } from '../context/ThemeContext';
import { authApi } from '../services/authApi';
import { getApiError } from '../context/AuthContext';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import AppText from '../components/atoms/Text';
import Button from '../components/atoms/Button';

type ForgotNavProp = NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;

interface ForgotPasswordScreenProps {
  navigation: ForgotNavProp;
}

const ANIM_COUNT = 4;

const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ navigation }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const fadeAnims = useRef(Array.from({ length: ANIM_COUNT }, () => new Animated.Value(0))).current;
  const slideAnims = useRef(Array.from({ length: ANIM_COUNT }, () => new Animated.Value(28))).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.stagger(
      80,
      fadeAnims.map((fade, i) =>
        Animated.parallel([
          Animated.timing(fade, { toValue: 1, duration: 380, useNativeDriver: true }),
          Animated.timing(slideAnims[i], { toValue: 0, duration: 380, useNativeDriver: true }),
        ])
      )
    ).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = (i: number) => ({
    opacity: fadeAnims[i],
    transform: [{ translateY: slideAnims[i] }],
  });

  const handleSend = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await authApi.forgotPassword(trimmed);
      setSent(true);
      Animated.parallel([
        Animated.spring(successScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
        Animated.timing(successOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]).start();
      // Navigate to OTP screen after brief delay
      setTimeout(() => {
        navigation.navigate('OTPVerification', { email: trimmed });
      }, 1200);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Decorative blobs */}
      <View style={styles.blobTL} />
      <View style={styles.blobBR} />

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <Animated.View style={[styles.backRow, animatedStyle(0)]}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </Animated.View>

        {/* Icon + heading */}
        <Animated.View style={[styles.headingBlock, animatedStyle(1)]}>
          <View style={[styles.iconCircle, { backgroundColor: colors.surface2 }]}>
            <Ionicons name="key-outline" size={32} color={colors.accent} />
          </View>
          <AppText variant="h2" style={styles.heading}>
            forgot password?
          </AppText>
          <AppText variant="caption" style={styles.subheading}>
            enter your email and we'll send you a reset code
          </AppText>
        </Animated.View>

        {/* Email field */}
        <Animated.View style={[styles.fieldBlock, animatedStyle(2)]}>
          <View style={[styles.inputWrapper, error ? styles.inputWrapperError : null]}>
            <Ionicons
              name="mail-outline"
              size={18}
              color={error ? colors.error : colors.textMuted}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(v) => { setEmail(v); setError(''); }}
              placeholder="your@email.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />
          </View>
          {error.length > 0 && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={13} color={colors.error} />
              <AppText variant="caption" style={styles.errorText}>{error}</AppText>
            </View>
          )}
        </Animated.View>

        {/* Send button */}
        <Animated.View style={[styles.btnBlock, animatedStyle(3)]}>
          {sent ? (
            <Animated.View
              style={[styles.sentBox, { opacity: successOpacity, transform: [{ scale: successScale }] }]}
            >
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              <AppText variant="label" style={[styles.sentText, { color: colors.success }]}>
                code sent! redirecting...
              </AppText>
            </Animated.View>
          ) : (
            <Button
              title="send reset code"
              onPress={handleSend}
              variant="primary"
              loading={isLoading}
              style={styles.sendBtn}
            />
          )}

          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.7}
            style={styles.loginLink}
          >
            <AppText style={styles.loginLinkText}>remember your password? </AppText>
            <AppText style={styles.loginLinkAccent}>log in</AppText>
            <Ionicons name="arrow-forward" size={15} color={colors.accent} style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

function createStyles(c: Colors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: c.background },
    blobTL: {
      position: 'absolute', width: 200, height: 200, borderRadius: 100,
      backgroundColor: c.accent, opacity: 0.06, top: -70, left: -50,
    },
    blobBR: {
      position: 'absolute', width: 140, height: 140, borderRadius: 70,
      backgroundColor: c.accent, opacity: 0.04, bottom: 100, right: -40,
    },
    container: {
      flexGrow: 1,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xl,
      paddingBottom: spacing.xxxxl,
    },
    backRow: { marginBottom: spacing.xl },
    backBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: c.border,
    },
    headingBlock: { alignItems: 'center', marginBottom: spacing.xxxl },
    iconCircle: {
      width: 72, height: 72, borderRadius: 36,
      alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
    },
    heading: {
      color: c.textPrimary, fontWeight: typography.weights.bold,
      textAlign: 'center', marginBottom: spacing.sm,
    },
    subheading: {
      color: c.textMuted, textAlign: 'center',
      lineHeight: typography.sizes.sm * 1.6, paddingHorizontal: spacing.lg,
    },
    fieldBlock: { marginBottom: spacing.xl },
    inputWrapper: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.surface, borderRadius: 14,
      borderWidth: 1.5, borderColor: c.border, paddingHorizontal: spacing.md, height: 52,
    },
    inputWrapperError: { borderColor: c.error },
    inputIcon: { marginRight: spacing.sm },
    input: { flex: 1, color: c.textPrimary, fontSize: typography.sizes.md },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
    errorText: { color: c.error, fontSize: typography.sizes.xs },
    btnBlock: {},
    sendBtn: { marginBottom: spacing.xl },
    sentBox: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: spacing.sm, paddingVertical: spacing.lg, marginBottom: spacing.xl,
    },
    sentText: { fontSize: typography.sizes.md, fontWeight: typography.weights.medium },
    loginLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    loginLinkText: { color: c.textSecondary, fontSize: typography.sizes.md },
    loginLinkAccent: { color: c.accent, fontSize: typography.sizes.md, fontWeight: typography.weights.semibold },
  });
}

export default ForgotPasswordScreen;
