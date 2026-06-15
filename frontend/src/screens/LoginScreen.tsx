import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  KeyboardAvoidingView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  StyleSheet,
  Animated,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AuthStackParamList } from '../types';
import { useColors, Colors } from '../context/ThemeContext';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import AppText from '../components/atoms/Text';
import Button from '../components/atoms/Button';
import { useAuth, getApiError } from '../context/AuthContext';

type LoginNavProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;
interface LoginScreenProps { navigation: LoginNavProp; }

const loginSchema = z.object({
  email: z.string().min(1, 'email is required').email('must be a valid email'),
  password: z.string().min(1, 'password is required'),
});
type LoginForm = z.infer<typeof loginSchema>;

const ANIM_COUNT = 5;

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { login } = useAuth();
  const [apiError, setApiError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const fadeAnims = useRef(Array.from({ length: ANIM_COUNT }, () => new Animated.Value(0))).current;
  const slideAnims = useRef(Array.from({ length: ANIM_COUNT }, () => new Animated.Value(28))).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

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

  const animStyle = (i: number) => ({ opacity: fadeAnims[i], transform: [{ translateY: slideAnims[i] }] });

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  };

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginForm) => {
    setApiError('');
    try {
      await login(data.email, data.password);
    } catch (err) {
      const msg = getApiError(err);
      setApiError(msg);
      shake();
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Decorative blobs */}
      <View style={styles.blobTR} />
      <View style={styles.blobBL} />

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <Animated.View style={[styles.brand, animStyle(0)]}>
          <View style={styles.logoCircle}>
            <AppText style={styles.logoLetter}>G</AppText>
          </View>
          <AppText variant="h2" style={styles.appName}>guised up</AppText>
          <AppText variant="caption" style={styles.tagline}>real people. real moments.</AppText>
        </Animated.View>

        {/* Form */}
        <Animated.View style={[styles.formCard, { transform: [{ translateX: shakeAnim }] }]}>
          <Animated.View style={animStyle(1)}>
            <AppText variant="h3" style={styles.formTitle}>welcome back</AppText>
            <AppText variant="caption" style={styles.formSubtitle}>sign in to continue</AppText>
          </Animated.View>

          {/* Email */}
          <Animated.View style={[styles.fieldGroup, animStyle(2)]}>
            <View style={[
              styles.inputWrapper,
              errors.email ? styles.inputWrapperError : focusedField === 'email' ? styles.inputWrapperFocused : null,
            ]}>
              <Ionicons
                name="mail-outline"
                size={18}
                color={errors.email ? colors.error : focusedField === 'email' ? colors.accent : colors.textMuted}
                style={styles.inputIcon}
              />
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value, onBlur } }) => (
                  <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={onChange}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => { setFocusedField(null); onBlur(); }}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    blurOnSubmit={false}
                  />
                )}
              />
            </View>
            {errors.email && (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle-outline" size={12} color={colors.error} />
                <AppText variant="caption" style={styles.errorText}>{errors.email.message}</AppText>
              </View>
            )}
          </Animated.View>

          {/* Password */}
          <Animated.View style={[styles.fieldGroup, animStyle(3)]}>
            <View style={[
              styles.inputWrapper,
              errors.password ? styles.inputWrapperError : focusedField === 'password' ? styles.inputWrapperFocused : null,
            ]}>
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={errors.password ? colors.error : focusedField === 'password' ? colors.accent : colors.textMuted}
                style={styles.inputIcon}
              />
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value, onBlur } }) => (
                  <TextInput
                    ref={passwordRef}
                    style={styles.input}
                    value={value}
                    onChangeText={onChange}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => { setFocusedField(null); onBlur(); }}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit(onSubmit)}
                  />
                )}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn} activeOpacity={0.7}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {errors.password && (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle-outline" size={12} color={colors.error} />
                <AppText variant="caption" style={styles.errorText}>{errors.password.message}</AppText>
              </View>
            )}
            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPassword')}
              activeOpacity={0.7}
              style={styles.forgotRow}
            >
              <Ionicons name="key-outline" size={14} color={colors.accent} />
              <AppText style={styles.forgotText}>forgot password?</AppText>
            </TouchableOpacity>
          </Animated.View>

          {apiError.length > 0 && (
            <View style={styles.apiErrorRow}>
              <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
              <AppText variant="caption" style={styles.apiErrorText}>{apiError}</AppText>
            </View>
          )}
        </Animated.View>

        {/* Actions */}
        <Animated.View style={[styles.actions, animStyle(4)]}>
          <Button
            title="log in"
            onPress={handleSubmit(onSubmit)}
            variant="primary"
            loading={isSubmitting}
            style={styles.submitBtn}
          />
          <TouchableOpacity
            onPress={() => navigation.navigate('Signup')}
            activeOpacity={0.7}
            style={styles.linkRow}
          >
            <AppText style={styles.linkText}>don't have an account? </AppText>
            <AppText style={styles.linkAccent}>sign up</AppText>
            <Ionicons name="arrow-forward" size={15} color={colors.accent} style={styles.linkIcon} />
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

function createStyles(c: Colors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: c.background },
    blobTR: {
      position: 'absolute', width: 220, height: 220, borderRadius: 110,
      backgroundColor: c.accent, opacity: 0.07, top: -80, right: -60,
    },
    blobBL: {
      position: 'absolute', width: 160, height: 160, borderRadius: 80,
      backgroundColor: c.accent, opacity: 0.04, bottom: 60, left: -50,
    },
    container: {
      flexGrow: 1,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xxxxl,
      paddingBottom: spacing.xxxxl,
      alignItems: 'center',
    },
    brand: { alignItems: 'center', marginBottom: spacing.xxxl },
    logoCircle: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: c.accent,
      alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
      shadowColor: c.accent, shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
    },
    logoLetter: {
      fontSize: 32, fontWeight: typography.weights.bold,
      color: '#FFFFFF', lineHeight: 38,
    },
    appName: {
      color: c.textPrimary, fontWeight: typography.weights.bold,
      letterSpacing: 0.5, marginBottom: 4,
    },
    tagline: { color: c.textMuted, letterSpacing: 0.3 },
    formCard: {
      width: '100%',
      backgroundColor: c.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: `${c.accent}22`,
      padding: spacing.xl,
      marginBottom: spacing.xl,
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.22,
      shadowRadius: 28,
      elevation: 14,
    },
    formTitle: {
      color: c.textPrimary, fontWeight: typography.weights.bold, marginBottom: 4,
    },
    formSubtitle: { color: c.textMuted, marginBottom: spacing.xl },
    fieldGroup: { marginBottom: spacing.md },
    inputWrapper: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.background, borderRadius: 12,
      borderWidth: 1.5, borderColor: c.border, paddingHorizontal: spacing.md, height: 50,
    },
    inputWrapperError: { borderColor: c.error, backgroundColor: `${c.error}06` },
    inputWrapperFocused: { borderColor: c.accent, backgroundColor: `${c.accent}06` },
    inputIcon: { marginRight: spacing.sm },
    input: { flex: 1, color: c.textPrimary, fontSize: typography.sizes.md },
    eyeBtn: { padding: spacing.xs },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
    errorText: { color: c.error, fontSize: typography.sizes.xs },
    forgotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5, marginTop: spacing.sm },
    forgotText: { color: c.accent, fontSize: typography.sizes.md, fontWeight: typography.weights.medium },
    apiErrorRow: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
      backgroundColor: `${c.error}12`, borderRadius: 8,
      padding: spacing.sm, marginTop: spacing.xs,
    },
    apiErrorText: { color: c.error, flex: 1, fontSize: typography.sizes.sm },
    actions: { width: '100%' },
    submitBtn: { marginBottom: spacing.lg },
    linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    linkText: { color: c.textSecondary, fontSize: typography.sizes.md },
    linkAccent: { color: c.accent, fontSize: typography.sizes.md, fontWeight: typography.weights.semibold },
    linkIcon: { marginLeft: 2 },
  });
}

export default LoginScreen;
