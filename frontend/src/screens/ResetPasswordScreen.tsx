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
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AuthStackParamList } from '../types';
import { useColors, Colors } from '../context/ThemeContext';
import { authApi } from '../services/authApi';
import { getApiError } from '../context/AuthContext';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import AppText from '../components/atoms/Text';
import Button from '../components/atoms/Button';

type ResetNavProp = NativeStackNavigationProp<AuthStackParamList, 'ResetPassword'>;
type ResetRouteProp = RouteProp<AuthStackParamList, 'ResetPassword'>;

interface ResetPasswordScreenProps {
  navigation: ResetNavProp;
  route: ResetRouteProp;
}

const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({ navigation, route }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { token } = route.params;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const confirmRef = useRef<TextInput>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const successScale = useRef(new Animated.Value(0.6)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

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

  const handleReset = async () => {
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      shake();
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      shake();
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
      Animated.parallel([
        Animated.spring(successScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
        Animated.timing(successOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]).start();
      setTimeout(() => navigation.navigate('Login'), 2000);
    } catch (err) {
      const msg = getApiError(err);
      setError(msg);
      Alert.alert('Reset failed', msg);
      shake();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
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
            <AppText variant="caption" style={styles.successSubtitle}>
              redirecting you to login...
            </AppText>
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
              {/* Password field */}
              <View style={styles.fieldGroup}>
                <View style={[styles.inputWrapper, error ? styles.inputWrapperError : null]}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color={error ? colors.error : colors.textMuted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={(v) => { setPassword(v); setError(''); }}
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
              </View>

              {/* Confirm field */}
              <View style={styles.fieldGroup}>
                <View style={[styles.inputWrapper, error ? styles.inputWrapperError : null]}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color={error ? colors.error : colors.textMuted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    ref={confirmRef}
                    style={styles.input}
                    value={confirm}
                    onChangeText={(v) => { setConfirm(v); setError(''); }}
                    placeholder="confirm password"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showConfirm}
                    returnKeyType="done"
                    onSubmitEditing={handleReset}
                  />
                  <TouchableOpacity onPress={() => setShowConfirm((v) => !v)} style={styles.eyeBtn} activeOpacity={0.7}>
                    <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              {error.length > 0 && (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle-outline" size={13} color={colors.error} />
                  <AppText variant="caption" style={styles.errorText}>{error}</AppText>
                </View>
              )}
            </Animated.View>

            <Button
              title="reset password"
              onPress={handleReset}
              variant="primary"
              loading={isLoading}
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
    inputWrapper: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.surface, borderRadius: 14,
      borderWidth: 1.5, borderColor: c.border, paddingHorizontal: spacing.md, height: 52,
    },
    inputWrapperError: { borderColor: c.error },
    inputIcon: { marginRight: spacing.sm },
    input: { flex: 1, color: c.textPrimary, fontSize: typography.sizes.md },
    eyeBtn: { padding: spacing.xs },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.md },
    errorText: { color: c.error, fontSize: typography.sizes.xs },
    resetBtn: { marginTop: spacing.sm },
    successBlock: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: spacing.xxxxl,
    },
    successTitle: {
      color: c.textPrimary, fontWeight: typography.weights.bold,
      textAlign: 'center', marginTop: spacing.xl, marginBottom: spacing.sm,
    },
    successSubtitle: { color: c.textMuted, textAlign: 'center' },
  });
}

export default ResetPasswordScreen;
