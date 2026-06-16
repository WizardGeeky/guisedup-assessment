import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AuthStackParamList } from '../types';
import { useColors, Colors } from '../context/ThemeContext';
import { authApi } from '../services/authApi';
import { getApiError } from '../context/AuthContext';
import { webInputReset } from '../utils/webStyle';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import AppText from '../components/atoms/Text';
import Button from '../components/atoms/Button';

type ResetNavProp = NativeStackNavigationProp<AuthStackParamList, 'ResetPassword'>;
type ResetRouteProp = RouteProp<AuthStackParamList, 'ResetPassword'>;
interface ResetPasswordScreenProps { navigation: ResetNavProp; route: ResetRouteProp; }

const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, 'password must be at least 8 characters')
      .max(128, 'password is too long'),
    confirm: z.string().min(1, 'please confirm your password'),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'passwords do not match',
    path: ['confirm'],
  });
type ResetForm = z.infer<typeof resetSchema>;

// Password strength: 0–4
function getStrength(pwd: string): number {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return Math.min(score, 4);
}

const STRENGTH_LABELS = ['', 'weak', 'fair', 'good', 'strong'];
const STRENGTH_COLORS = ['', '#EF4444', '#F59E0B', '#22C55E', '#16A34A'];

const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({ navigation, route }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { token } = route.params;
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const confirmRef = useRef<TextInput>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const successScale = useRef(new Animated.Value(0.6)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  const { control, handleSubmit, watch, setError, formState: { errors, isSubmitting } } =
    useForm<ResetForm>({
      resolver: zodResolver(resetSchema),
      defaultValues: { password: '', confirm: '' },
      mode: 'onTouched',
    });

  const passwordValue = watch('password');
  const strength = getStrength(passwordValue);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -5, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  };

  const onSubmit = async (data: ResetForm) => {
    try {
      await authApi.resetPassword(token, data.password);
      setSuccess(true);
      Animated.parallel([
        Animated.spring(successScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
        Animated.timing(successOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]).start();
      setTimeout(() => navigation.navigate('Login'), 2000);
    } catch (err) {
      const msg = getApiError(err);
      setError('password', { message: msg });
      shake();
    }
  };

  const wrapperStyle = (field: string, hasError: boolean) => [
    styles.inputWrapper,
    hasError ? styles.inputWrapperError : focusedField === field ? styles.inputWrapperFocused : null,
  ];

  const iconColor = (field: string, hasError: boolean) =>
    hasError ? colors.error : focusedField === field ? colors.accent : colors.textMuted;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.blobTL} />
      <View style={styles.blobBR} />

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        {success ? (
          <Animated.View style={[styles.successBlock, { opacity: successOpacity, transform: [{ scale: successScale }] }]}>
            <Ionicons name="checkmark-circle" size={72} color={colors.success} />
            <AppText variant="h2" style={styles.successTitle}>password reset!</AppText>
            <AppText variant="caption" style={styles.successSubtitle}>redirecting you to login...</AppText>
          </Animated.View>
        ) : (
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={styles.headingBlock}>
              <View style={[styles.iconCircle, { backgroundColor: colors.surface2 }]}>
                <Ionicons name="lock-open-outline" size={32} color={colors.accent} />
              </View>
              <AppText variant="h2" style={styles.heading}>new password</AppText>
              <AppText variant="caption" style={styles.subheading}>
                choose a strong password for your account
              </AppText>
            </View>

            <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
              {/* Password */}
              <View style={styles.fieldGroup}>
                <AppText variant="label" style={styles.fieldLabel}>new password</AppText>
                <Controller
                  control={control}
                  name="password"
                  render={({ field: { onChange, value, onBlur } }) => (
                    <View style={wrapperStyle('password', !!errors.password)}>
                      <Ionicons name="lock-closed-outline" size={18} color={iconColor('password', !!errors.password)} style={styles.inputIcon} />
                      <TextInput
                        style={[styles.input, webInputReset]}
                        value={value}
                        onChangeText={onChange}
                        onFocus={() => setFocusedField('password')}
                        onBlur={() => { setFocusedField(null); onBlur(); }}
                        placeholder="new password"
                        placeholderTextColor={colors.textMuted}
                        secureTextEntry={!showPassword}
                        returnKeyType="next"
                        onSubmitEditing={() => confirmRef.current?.focus()}
                        blurOnSubmit={false}
                      />
                      <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn} activeOpacity={0.7}>
                        <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  )}
                />
                {/* Strength bar */}
                {passwordValue.length > 0 && (
                  <View style={styles.strengthRow}>
                    <View style={styles.strengthBars}>
                      {[1, 2, 3, 4].map((level) => (
                        <View
                          key={level}
                          style={[
                            styles.strengthBar,
                            { backgroundColor: strength >= level ? STRENGTH_COLORS[strength] : colors.border },
                          ]}
                        />
                      ))}
                    </View>
                    <AppText style={[styles.strengthLabel, { color: STRENGTH_COLORS[strength] || colors.textMuted }]}>
                      {STRENGTH_LABELS[strength]}
                    </AppText>
                  </View>
                )}
                {errors.password && (
                  <View style={styles.errorRow}>
                    <Ionicons name="alert-circle-outline" size={13} color={colors.error} />
                    <AppText style={styles.errorText}>{errors.password.message}</AppText>
                  </View>
                )}
              </View>

              {/* Confirm */}
              <View style={styles.fieldGroup}>
                <AppText variant="label" style={styles.fieldLabel}>confirm password</AppText>
                <Controller
                  control={control}
                  name="confirm"
                  render={({ field: { onChange, value, onBlur } }) => (
                    <View style={wrapperStyle('confirm', !!errors.confirm)}>
                      <Ionicons name="lock-closed-outline" size={18} color={iconColor('confirm', !!errors.confirm)} style={styles.inputIcon} />
                      <TextInput
                        ref={confirmRef}
                        style={[styles.input, webInputReset]}
                        value={value}
                        onChangeText={onChange}
                        onFocus={() => setFocusedField('confirm')}
                        onBlur={() => { setFocusedField(null); onBlur(); }}
                        placeholder="confirm password"
                        placeholderTextColor={colors.textMuted}
                        secureTextEntry={!showConfirm}
                        returnKeyType="done"
                        onSubmitEditing={handleSubmit(onSubmit)}
                      />
                      <TouchableOpacity onPress={() => setShowConfirm((v) => !v)} style={styles.eyeBtn} activeOpacity={0.7}>
                        <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  )}
                />
                {errors.confirm && (
                  <View style={styles.errorRow}>
                    <Ionicons name="alert-circle-outline" size={13} color={colors.error} />
                    <AppText style={styles.errorText}>{errors.confirm.message}</AppText>
                  </View>
                )}
              </View>
            </Animated.View>

            <Button
              title="reset password"
              onPress={handleSubmit(onSubmit)}
              variant="primary"
              loading={isSubmitting}
              style={styles.resetBtn}
            />
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

function createStyles(c: Colors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: c.background },
    blobTL: {
      position: 'absolute', width: 180, height: 180, borderRadius: 90,
      backgroundColor: c.accent, opacity: 0.06, top: -60, left: -50,
    },
    blobBR: {
      position: 'absolute', width: 120, height: 120, borderRadius: 60,
      backgroundColor: c.accent, opacity: 0.04, bottom: 80, right: -30,
    },
    container: {
      flexGrow: 1,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xl,
      paddingBottom: spacing.xxxxl,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: c.border, marginBottom: spacing.xl,
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
    fieldGroup: { marginBottom: spacing.lg },
    fieldLabel: {
      color: c.textSecondary, fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium, marginBottom: spacing.xs,
    },
    inputWrapper: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.surface2, borderRadius: 14,
      paddingHorizontal: spacing.md, height: 52,
    },
    inputWrapperError: { backgroundColor: `${c.error}12` },
    inputWrapperFocused: { backgroundColor: `${c.accent}10` },
    inputIcon: { marginRight: spacing.sm },
    input: { flex: 1, color: c.textPrimary, fontSize: typography.sizes.md, outlineWidth: 0 } as any,
    eyeBtn: { padding: spacing.xs },
    // Strength bar
    strengthRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
    strengthBars: { flexDirection: 'row', gap: 4, flex: 1 },
    strengthBar: { flex: 1, height: 4, borderRadius: 2 },
    strengthLabel: { fontSize: typography.sizes.xs, fontWeight: typography.weights.medium, minWidth: 36 },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
    errorText: { color: c.error, fontSize: typography.sizes.sm, flex: 1 },
    resetBtn: { marginTop: spacing.sm },
    successBlock: {
      flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xxxxl,
    },
    successTitle: {
      color: c.textPrimary, fontWeight: typography.weights.bold,
      textAlign: 'center', marginTop: spacing.xl, marginBottom: spacing.sm,
    },
    successSubtitle: { color: c.textMuted, textAlign: 'center' },
  });
}

export default ResetPasswordScreen;
