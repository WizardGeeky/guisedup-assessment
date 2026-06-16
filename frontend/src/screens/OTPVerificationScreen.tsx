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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AuthStackParamList } from '../types';
import { useColors, Colors } from '../context/ThemeContext';
import { authApi } from '../services/authApi';
import { webInputReset } from '../utils/webStyle';
import { getApiError } from '../context/AuthContext';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import AppText from '../components/atoms/Text';
import Button from '../components/atoms/Button';

type OTPNavProp = NativeStackNavigationProp<AuthStackParamList, 'OTPVerification'>;
type OTPRouteProp = RouteProp<AuthStackParamList, 'OTPVerification'>;

interface OTPVerificationScreenProps {
  navigation: OTPNavProp;
  route: OTPRouteProp;
}

const OTP_LENGTH = 6;

const OTPVerificationScreen: React.FC<OTPVerificationScreenProps> = ({ navigation, route }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { email } = route.params;
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(60);
  const [isResending, setIsResending] = useState(false);

  const inputRefs = useRef<Array<TextInput | null>>(Array(OTP_LENGTH).fill(null));
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
    // Auto-focus first box
    setTimeout(() => inputRefs.current[0]?.focus(), 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -5, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  };

  const handleChange = (text: string, index: number) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    setError('');
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < OTP_LENGTH) {
      setError('Please enter the complete 6-digit code');
      shake();
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const { resetToken } = await authApi.verifyOtp(email, code);
      navigation.navigate('ResetPassword', { email, token: resetToken });
    } catch (err) {
      setError(getApiError(err));
      shake();
      setOtp(Array(OTP_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;
    setIsResending(true);
    setError('');
    try {
      await authApi.forgotPassword(email);
      setCooldown(60);
      setOtp(Array(OTP_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.blobTL} />

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {/* Heading */}
          <View style={styles.headingBlock}>
            <View style={[styles.iconCircle, { backgroundColor: colors.surface2 }]}>
              <Ionicons name="shield-checkmark-outline" size={32} color={colors.accent} />
            </View>
            <AppText variant="h2" style={styles.heading}>check your email</AppText>
            <AppText variant="caption" style={styles.subheading}>
              we sent a 6-digit code to
            </AppText>
            <AppText variant="label" style={styles.emailText}>{email}</AppText>
          </View>

          {/* OTP Boxes */}
          <Animated.View style={[styles.otpRow, { transform: [{ translateX: shakeAnim }] }]}>
            {Array.from({ length: OTP_LENGTH }).map((_, i) => (
              <TextInput
                key={i}
                ref={(ref) => { inputRefs.current[i] = ref; }}
                style={[
                  styles.otpBox,
                  otp[i] ? styles.otpBoxFilled : null,
                  webInputReset,
                ]}
                value={otp[i]}
                onChangeText={(t) => handleChange(t, i)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                caretHidden
              />
            ))}
          </Animated.View>

          {error.length > 0 && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={13} color={colors.error} />
              <AppText variant="caption" style={styles.errorText}>{error}</AppText>
            </View>
          )}

          {/* Verify button */}
          <Button
            title="verify code"
            onPress={handleVerify}
            variant="primary"
            loading={isLoading}
            style={styles.verifyBtn}
          />

          {/* Resend */}
          <TouchableOpacity
            onPress={handleResend}
            activeOpacity={cooldown > 0 ? 1 : 0.7}
            style={styles.resendRow}
          >
            {isResending ? (
              <AppText variant="caption" style={styles.resendText}>sending...</AppText>
            ) : cooldown > 0 ? (
              <AppText variant="caption" style={styles.resendText}>
                resend code in{' '}
                <AppText variant="caption" style={styles.resendCountdown}>{cooldown}s</AppText>
              </AppText>
            ) : (
              <AppText variant="caption" style={styles.resendActive}>resend code</AppText>
            )}
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
      position: 'absolute', width: 220, height: 220, borderRadius: 110,
      backgroundColor: c.accent, opacity: 0.05, top: -80, right: -60,
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
    subheading: { color: c.textMuted, textAlign: 'center', marginBottom: 4 },
    emailText: {
      color: c.accent, fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold, textAlign: 'center',
    },
    otpRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    otpBox: {
      width: 46,
      height: 56,
      borderRadius: 12,
      backgroundColor: c.surface2,
      textAlign: 'center',
      fontSize: 22,
      fontWeight: typography.weights.bold,
      color: c.textPrimary,
      outlineWidth: 0,
    } as any,
    otpBoxFilled: {
      backgroundColor: `${c.accent}14`,
    },
    errorRow: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      marginBottom: spacing.md, justifyContent: 'center',
    },
    errorText: { color: c.error, fontSize: typography.sizes.xs },
    verifyBtn: { marginBottom: spacing.xl },
    resendRow: { alignItems: 'center' },
    resendText: { color: c.textMuted },
    resendCountdown: { color: c.accent, fontWeight: typography.weights.semibold },
    resendActive: { color: c.accent, fontWeight: typography.weights.medium },
  });
}

export default OTPVerificationScreen;
