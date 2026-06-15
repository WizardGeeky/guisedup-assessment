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

type SignupNavProp = NativeStackNavigationProp<AuthStackParamList, 'Signup'>;
interface SignupScreenProps { navigation: SignupNavProp; }

const signupSchema = z.object({
  username: z.string().min(2, 'at least 2 characters').max(30).regex(/^[a-z0-9_]+$/, 'lowercase, numbers & underscores only'),
  email: z.string().min(1, 'email is required').email('must be a valid email'),
  password: z.string().min(6, 'at least 6 characters'),
});
type SignupForm = z.infer<typeof signupSchema>;

const ANIM_COUNT = 6;

const SignupScreen: React.FC<SignupScreenProps> = ({ navigation }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { register } = useAuth();
  const [apiError, setApiError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const fadeAnims = useRef(Array.from({ length: ANIM_COUNT }, () => new Animated.Value(0))).current;
  const slideAnims = useRef(Array.from({ length: ANIM_COUNT }, () => new Animated.Value(28))).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(
      70,
      fadeAnims.map((fade, i) =>
        Animated.parallel([
          Animated.timing(fade, { toValue: 1, duration: 360, useNativeDriver: true }),
          Animated.timing(slideAnims[i], { toValue: 0, duration: 360, useNativeDriver: true }),
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

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<SignupForm>({
    defaultValues: { username: '', email: '', password: '' },
  });

  const onSubmit = async (data: SignupForm) => {
    setApiError('');
    try {
      await register(data.email, data.username, data.password);
    } catch (err) {
      const msg = getApiError(err);
      setApiError(msg);
      shake();
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.blobTL} />
      <View style={styles.blobBR} />

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
          <AppText variant="h2" style={styles.appName}>join guised up</AppText>
          <AppText variant="caption" style={styles.tagline}>real side of social</AppText>
        </Animated.View>

        {/* Form */}
        <Animated.View style={[styles.formCard, { transform: [{ translateX: shakeAnim }] }]}>
          {/* Username */}
          <Animated.View style={[styles.fieldGroup, animStyle(1)]}>
            <AppText variant="label" style={styles.label}>username</AppText>
            <View style={[
              styles.inputWrapper,
              errors.username ? styles.inputWrapperError : focusedField === 'username' ? styles.inputWrapperFocused : null,
            ]}>
              <Ionicons name="at-outline" size={18} color={errors.username ? colors.error : focusedField === 'username' ? colors.accent : colors.textMuted} style={styles.inputIcon} />
              <Controller
                control={control}
                name="username"
                render={({ field: { onChange, value, onBlur } }) => (
                  <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={onChange}
                    onFocus={() => setFocusedField('username')}
                    onBlur={() => { setFocusedField(null); onBlur(); }}
                    placeholder="your_handle"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                    blurOnSubmit={false}
                  />
                )}
              />
            </View>
            {errors.username && (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle-outline" size={12} color={colors.error} />
                <AppText variant="caption" style={styles.errorText}>{errors.username.message}</AppText>
              </View>
            )}
          </Animated.View>

          {/* Email */}
          <Animated.View style={[styles.fieldGroup, animStyle(2)]}>
            <AppText variant="label" style={styles.label}>email</AppText>
            <View style={[
              styles.inputWrapper,
              errors.email ? styles.inputWrapperError : focusedField === 'email' ? styles.inputWrapperFocused : null,
            ]}>
              <Ionicons name="mail-outline" size={18} color={errors.email ? colors.error : focusedField === 'email' ? colors.accent : colors.textMuted} style={styles.inputIcon} />
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value, onBlur } }) => (
                  <TextInput
                    ref={emailRef}
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
            <AppText variant="label" style={styles.label}>password</AppText>
            <View style={[
              styles.inputWrapper,
              errors.password ? styles.inputWrapperError : focusedField === 'password' ? styles.inputWrapperFocused : null,
            ]}>
              <Ionicons name="lock-closed-outline" size={18} color={errors.password ? colors.error : focusedField === 'password' ? colors.accent : colors.textMuted} style={styles.inputIcon} />
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
                    placeholder="at least 6 characters"
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
            title="create account"
            onPress={handleSubmit(onSubmit)}
            variant="primary"
            loading={isSubmitting}
            style={styles.submitBtn}
          />
        </Animated.View>

        <Animated.View style={[styles.linkRow, animStyle(5)]}>
          <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.7} style={styles.linkInner}>
            <AppText style={styles.linkText}>already have an account? </AppText>
            <AppText style={styles.linkAccent}>log in</AppText>
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
    blobTL: {
      position: 'absolute', width: 200, height: 200, borderRadius: 100,
      backgroundColor: c.accent, opacity: 0.07, top: -70, left: -60,
    },
    blobBR: {
      position: 'absolute', width: 150, height: 150, borderRadius: 75,
      backgroundColor: c.accent, opacity: 0.04, bottom: 40, right: -50,
    },
    container: {
      flexGrow: 1,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xxxl,
      paddingBottom: spacing.xxxxl,
      alignItems: 'center',
    },
    brand: { alignItems: 'center', marginBottom: spacing.xl },
    logoCircle: {
      width: 64, height: 64, borderRadius: 32, backgroundColor: c.accent,
      alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
      shadowColor: c.accent, shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35, shadowRadius: 10, elevation: 8,
    },
    logoLetter: { fontSize: 28, fontWeight: typography.weights.bold, color: '#FFFFFF', lineHeight: 34 },
    appName: { color: c.textPrimary, fontWeight: typography.weights.bold, letterSpacing: 0.5, marginBottom: 4 },
    tagline: { color: c.textMuted, letterSpacing: 0.3 },
    formCard: {
      width: '100%', backgroundColor: c.surface, borderRadius: 20,
      borderWidth: 1, borderColor: `${c.accent}22`, padding: spacing.xl, marginBottom: spacing.xl,
      shadowColor: c.accent, shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.22, shadowRadius: 28, elevation: 14,
    },
    fieldGroup: { marginBottom: spacing.md },
    label: { color: c.textSecondary, fontSize: typography.sizes.sm, marginBottom: spacing.xs },
    inputWrapper: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: c.background,
      borderRadius: 12, borderWidth: 1.5, borderColor: c.border, paddingHorizontal: spacing.md, height: 50,
    },
    inputWrapperError: { borderColor: c.error, backgroundColor: `${c.error}06` },
    inputWrapperFocused: { borderColor: c.accent, backgroundColor: `${c.accent}06` },
    inputIcon: { marginRight: spacing.sm },
    input: { flex: 1, color: c.textPrimary, fontSize: typography.sizes.md },
    eyeBtn: { padding: spacing.xs },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
    errorText: { color: c.error, fontSize: typography.sizes.xs },
    apiErrorRow: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
      backgroundColor: `${c.error}12`, borderRadius: 8, padding: spacing.sm, marginTop: spacing.xs,
    },
    apiErrorText: { color: c.error, flex: 1, fontSize: typography.sizes.sm },
    actions: { width: '100%' },
    submitBtn: { marginBottom: spacing.lg },
    linkRow: { alignItems: 'center' },
    linkInner: { flexDirection: 'row', alignItems: 'center' },
    linkText: { color: c.textSecondary, fontSize: typography.sizes.md },
    linkAccent: { color: c.accent, fontSize: typography.sizes.md, fontWeight: typography.weights.semibold },
    linkIcon: { marginLeft: 2 },
  });
}

export default SignupScreen;
