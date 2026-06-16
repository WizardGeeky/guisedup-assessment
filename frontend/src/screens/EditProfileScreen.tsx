import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useColors, Colors } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { userApi } from '../services/userApi';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { webInputReset } from '../utils/webStyle';
import AppText from '../components/atoms/Text';


const GENDERS = ['male', 'female', 'other', 'prefer not to say'] as const;
type Gender = typeof GENDERS[number];

const profileSchema = z.object({
  fullName: z
    .string()
    .min(1, 'full name is required')
    .max(60, 'max 60 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'letters, spaces, hyphens and apostrophes only'),
  bio: z.string().max(200, 'max 200 characters').optional(),
  dob: z
    .string()
    .min(1, 'date of birth is required')
    .regex(/^\d{2}\/\d{2}\/\d{4}$/, 'format must be DD/MM/YYYY'),
  phone: z
    .string()
    .min(1, 'phone number is required')
    .regex(/^\+?[0-9\s\-()]{7,15}$/, 'enter a valid phone number'),
  gender: z.enum(GENDERS, { errorMap: () => ({ message: 'select a gender' }) }),
});

type ProfileForm = z.infer<typeof profileSchema>;
const PROFILE_KEY = (uid: string) => `@guisedup:profile:${uid}`;

const EditProfileScreen: React.FC = () => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const { user, updateUserProfile } = useAuth();

  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatarUrl ?? null);
  const [isPickingImage, setIsPickingImage] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: '', bio: user?.bio ?? '', dob: '', phone: '', gender: 'prefer not to say' },
    mode: 'onTouched',
  });

  const selectedGender = watch('gender');

  useEffect(() => {
    if (!user?.id) return;
    AsyncStorage.getItem(PROFILE_KEY(user.id))
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as Partial<ProfileForm>;
        if (saved.fullName) setValue('fullName', saved.fullName);
        if (saved.dob) setValue('dob', saved.dob);
        if (saved.phone) setValue('phone', saved.phone);
        if (saved.gender) setValue('gender', saved.gender as Gender);
      })
      .catch(() => {});
  }, [user?.id, setValue]);

  const pickImage = async () => {
    try {
      setIsPickingImage(true);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow access to your photos to set a profile picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          const ext = asset.mimeType?.split('/')[1] ?? 'jpeg';
          const dataUri = `data:image/${ext};base64,${asset.base64}`;
          setAvatarUri(dataUri);
        } else if (asset.uri) {
          setAvatarUri(asset.uri);
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    } finally {
      setIsPickingImage(false);
    }
  };

  const onSubmit = async (data: ProfileForm) => {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      // Save personal info (not in DB) to AsyncStorage
      await AsyncStorage.setItem(PROFILE_KEY(user.id), JSON.stringify({
        fullName: data.fullName,
        dob: data.dob,
        phone: data.phone,
        gender: data.gender,
      }));

      // Save bio + avatar to backend
      const patch: { bio?: string; avatarUrl?: string } = {};
      if (data.bio !== undefined) patch.bio = data.bio;
      if (avatarUri !== user.avatarUrl) patch.avatarUrl = avatarUri ?? undefined;

      if (Object.keys(patch).length > 0) {
        await userApi.updateProfile(patch);
        await updateUserProfile({
          bio: patch.bio ?? user.bio,
          avatarUrl: patch.avatarUrl !== undefined ? (patch.avatarUrl ?? null) : user.avatarUrl,
        });
      }

      setSaved(true);
      setTimeout(() => navigation.goBack(), 800);
    } catch {
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDob = (text: string, onChange: (v: string) => void) => {
    const digits = text.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    onChange(formatted);
  };

  if (!user) return null;

  const initial = user.username.charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <AppText style={styles.headerTitle}>edit profile</AppText>
        <TouchableOpacity
          onPress={handleSubmit(onSubmit)}
          style={[styles.saveBtn, { backgroundColor: saved ? colors.success : colors.accent }]}
          activeOpacity={0.85}
          disabled={isSaving || saved}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : saved ? (
            <Ionicons name="checkmark" size={18} color="#FFF" />
          ) : (
            <AppText style={styles.saveBtnText}>save</AppText>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={pickImage} activeOpacity={0.85} style={styles.avatarWrap} disabled={isPickingImage}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatarCircle, { backgroundColor: colors.accent }]}>
                  <AppText style={styles.avatarLetter}>{initial}</AppText>
                </View>
              )}
              <View style={[styles.cameraBtn, { backgroundColor: colors.accent }]}>
                {isPickingImage
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Ionicons name="camera" size={14} color="#FFF" />}
              </View>
            </TouchableOpacity>
            <AppText style={[styles.changePhotoHint, { color: colors.accent }]}>tap to change photo</AppText>
          </View>

          {/* Read-only fields */}
          <View style={styles.readOnlyCard}>
            <AppText style={styles.readOnlyLabel}>these can't be changed</AppText>
            <View style={styles.readOnlyRow}>
              <Ionicons name="at-outline" size={16} color={colors.textMuted} />
              <AppText style={styles.readOnlyValue}>@{user.username}</AppText>
              <View style={styles.lockedBadge}>
                <Ionicons name="lock-closed-outline" size={11} color={colors.textMuted} />
              </View>
            </View>
            <View style={[styles.readOnlyRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
              <AppText style={styles.readOnlyValue}>{user.email}</AppText>
              <View style={styles.lockedBadge}>
                <Ionicons name="lock-closed-outline" size={11} color={colors.textMuted} />
              </View>
            </View>
          </View>

          {/* Bio */}
          <View style={styles.section}>
            <AppText style={styles.sectionTitle}>about you</AppText>
            <View style={styles.fieldGroup}>
              <AppText style={styles.label}>bio</AppText>
              <Controller
                control={control}
                name="bio"
                render={({ field: { onChange, value, onBlur } }) => (
                  <View style={[styles.textAreaWrapper, errors.bio && styles.inputWrapperError]}>
                    <TextInput
                      style={[styles.textArea, webInputReset, { color: colors.textPrimary }]}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="tell people about yourself..."
                      placeholderTextColor={colors.textMuted}
                      multiline
                      maxLength={200}
                      returnKeyType="done"
                    />
                  </View>
                )}
              />
              {errors.bio && <ErrorMsg message={errors.bio.message!} colors={colors} />}
            </View>
          </View>

          {/* Personal Info */}
          <View style={styles.section}>
            <AppText style={styles.sectionTitle}>personal info</AppText>

            <View style={styles.fieldGroup}>
              <AppText style={styles.label}>full name</AppText>
              <Controller
                control={control}
                name="fullName"
                render={({ field: { onChange, value, onBlur } }) => (
                  <View style={[styles.inputWrapper, errors.fullName && styles.inputWrapperError]}>
                    <Ionicons name="person-outline" size={17} color={errors.fullName ? colors.error : colors.textMuted} style={styles.inputIcon} />
                    <TextInput style={[styles.input, webInputReset]} value={value} onChangeText={onChange} onBlur={onBlur} placeholder="your full name" placeholderTextColor={colors.textMuted} autoCapitalize="words" returnKeyType="next" />
                  </View>
                )}
              />
              {errors.fullName && <ErrorMsg message={errors.fullName.message!} colors={colors} />}
            </View>

            <View style={styles.fieldGroup}>
              <AppText style={styles.label}>date of birth</AppText>
              <Controller
                control={control}
                name="dob"
                render={({ field: { onChange, value, onBlur } }) => (
                  <View style={[styles.inputWrapper, errors.dob && styles.inputWrapperError]}>
                    <Ionicons name="calendar-outline" size={17} color={errors.dob ? colors.error : colors.textMuted} style={styles.inputIcon} />
                    <TextInput style={[styles.input, webInputReset]} value={value} onChangeText={(t) => formatDob(t, onChange)} onBlur={onBlur} placeholder="DD/MM/YYYY" placeholderTextColor={colors.textMuted} keyboardType="number-pad" maxLength={10} returnKeyType="next" />
                  </View>
                )}
              />
              {errors.dob && <ErrorMsg message={errors.dob.message!} colors={colors} />}
            </View>

            <View style={styles.fieldGroup}>
              <AppText style={styles.label}>phone number</AppText>
              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, value, onBlur } }) => (
                  <View style={[styles.inputWrapper, errors.phone && styles.inputWrapperError]}>
                    <Ionicons name="call-outline" size={17} color={errors.phone ? colors.error : colors.textMuted} style={styles.inputIcon} />
                    <TextInput style={[styles.input, webInputReset]} value={value} onChangeText={onChange} onBlur={onBlur} placeholder="+91 98765 43210" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" returnKeyType="done" />
                  </View>
                )}
              />
              {errors.phone && <ErrorMsg message={errors.phone.message!} colors={colors} />}
            </View>

            <View style={styles.fieldGroup}>
              <AppText style={styles.label}>gender</AppText>
              <View style={styles.genderGrid}>
                {GENDERS.map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.genderChip, selectedGender === g && { backgroundColor: colors.accent, borderColor: colors.accent }]}
                    onPress={() => setValue('gender', g, { shouldValidate: true })}
                    activeOpacity={0.7}
                  >
                    <AppText style={[styles.genderChipText, selectedGender === g && { color: '#FFF', fontWeight: typography.weights.semibold }]}>
                      {g}
                    </AppText>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.gender && <ErrorMsg message={errors.gender.message!} colors={colors} />}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const ErrorMsg: React.FC<{ message: string; colors: Colors }> = ({ message, colors }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 }}>
    <Ionicons name="alert-circle-outline" size={12} color={colors.error} />
    <AppText style={{ color: colors.error, fontSize: typography.sizes.xs, flex: 1 }}>{message}</AppText>
  </View>
);

function createStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: c.textPrimary },
    saveBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 12, minWidth: 60, alignItems: 'center' },
    saveBtnText: { color: '#FFF', fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
    scrollContent: { paddingBottom: spacing.xxxxl },

    // Avatar
    avatarSection: { alignItems: 'center', paddingVertical: spacing.xl },
    avatarWrap: { position: 'relative', marginBottom: spacing.sm },
    avatarImage: { width: 90, height: 90, borderRadius: 45 },
    avatarCircle: {
      width: 90, height: 90, borderRadius: 45,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: c.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
    },
    avatarLetter: { fontSize: 38, fontWeight: typography.weights.bold, color: '#FFF', lineHeight: 46 },
    cameraBtn: {
      position: 'absolute', bottom: 2, right: 2,
      width: 28, height: 28, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: c.background,
    },
    changePhotoHint: { fontSize: typography.sizes.xs, fontWeight: '600' },

    // Read-only card
    readOnlyCard: { marginHorizontal: spacing.lg, backgroundColor: c.surface2, borderRadius: 14, borderWidth: 1, borderColor: c.border, marginBottom: spacing.xl, overflow: 'hidden' },
    readOnlyLabel: { fontSize: typography.sizes.xs, color: c.textMuted, fontWeight: typography.weights.semibold, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
    readOnlyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    readOnlyValue: { flex: 1, fontSize: typography.sizes.md, color: c.textSecondary },
    lockedBadge: { width: 22, height: 22, borderRadius: 6, backgroundColor: c.border, alignItems: 'center', justifyContent: 'center' },

    // Form
    section: { paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
    sectionTitle: { fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.md },
    fieldGroup: { marginBottom: spacing.lg },
    label: { fontSize: typography.sizes.sm, color: c.textSecondary, fontWeight: typography.weights.medium, marginBottom: spacing.xs },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface2, borderRadius: 12, paddingHorizontal: spacing.md, height: 50 },
    inputWrapperError: { backgroundColor: `${c.error}12` },
    inputIcon: { marginRight: spacing.sm },
    input: { flex: 1, color: c.textPrimary, fontSize: typography.sizes.md },
    textAreaWrapper: { backgroundColor: c.surface2, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    textArea: { minHeight: 80, fontSize: typography.sizes.md, textAlignVertical: 'top' },
    genderGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    genderChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 10, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface },
    genderChipText: { fontSize: typography.sizes.sm, color: c.textSecondary },
  });
}

export default EditProfileScreen;
